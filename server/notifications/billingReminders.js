/**
 * Lembretes de cobrança / trial — Etapa 7.6
 * Gera notificações em: -7, -3, -1, vencimento, +3 dias de atraso.
 */
import { query } from '../db.js';

const REMINDER_OFFSETS = [
  { offset: 7, codigo: 'cobranca_d7', titulo: 'Cobrança em 7 dias' },
  { offset: 3, codigo: 'cobranca_d3', titulo: 'Cobrança em 3 dias' },
  { offset: 1, codigo: 'cobranca_d1', titulo: 'Cobrança amanhã' },
  { offset: 0, codigo: 'cobranca_d0', titulo: 'Cobrança vence hoje' },
  { offset: -3, codigo: 'cobranca_atraso3', titulo: 'Cobrança em atraso' },
];

const TRIAL_OFFSETS = [
  { offset: 7, codigo: 'trial_d7', titulo: 'Trial termina em 7 dias' },
  { offset: 3, codigo: 'trial_d3', titulo: 'Trial termina em 3 dias' },
  { offset: 1, codigo: 'trial_d1', titulo: 'Último dia do trial' },
];

function toDateKey(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  return x.toISOString().slice(0, 10);
}

function daysUntil(refDate) {
  const end = new Date(refDate);
  end.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((end - now) / 86400000);
}

function formatPtDate(refDate) {
  try {
    return new Date(refDate).toLocaleDateString('pt-BR');
  } catch {
    return '';
  }
}

async function upsertNotification(usuarioId, { tipo, titulo, mensagem, codigo, metadata = {} }) {
  if (!codigo) return;
  await query(
    `INSERT INTO usuario_notificacoes (usuario_id, tipo, titulo, mensagem, codigo, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (usuario_id, codigo) DO NOTHING`,
    [usuarioId, tipo, titulo, mensagem, codigo, JSON.stringify(metadata)]
  );
}

export async function syncBillingRemindersForUser(usuarioId) {
  const { rows } = await query(
    `SELECT a.status, a.trial_ate, a.proxima_cobranca, p.nome AS plano_nome, p.preco_centavos
     FROM assinaturas a
     JOIN planos p ON p.id = a.plano_id
     WHERE a.usuario_id = $1`,
    [usuarioId]
  );
  if (!rows.length) return { created: 0 };

  const sub = rows[0];
  let created = 0;

  if (sub.status === 'trial' && sub.trial_ate) {
    const dias = daysUntil(sub.trial_ate);
    for (const r of TRIAL_OFFSETS) {
      if (dias !== r.offset) continue;
      const dk = toDateKey(sub.trial_ate);
      const codigo = `${r.codigo}_${dk}`;
      const valor =
        sub.preco_centavos != null
          ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
              sub.preco_centavos / 100
            )
          : '';
      await upsertNotification(usuarioId, {
        tipo: 'assinatura',
        titulo: r.titulo,
        mensagem: `Seu período de teste do plano ${sub.plano_nome || 'Fluxiva'} termina em ${formatPtDate(sub.trial_ate)}.${valor ? ` Após o trial: ${valor}/mês.` : ''} Ative seu plano no Portal do Cliente.`,
        codigo,
        metadata: { dias_restantes: dias, trial_ate: dk },
      });
      created += 1;
    }
  }

  if (sub.status === 'trial') return { created };

  const anchor = sub.proxima_cobranca;
  if (!anchor) return { created };

  const diasCob = daysUntil(anchor);
  const dk = toDateKey(anchor);

  for (const r of REMINDER_OFFSETS) {
    if (diasCob !== r.offset) continue;
    if (sub.status === 'cancelada' || sub.status === 'vencida') continue;

    let mensagem;
    if (r.offset === -3) {
      mensagem = `Sua cobrança venceu em ${formatPtDate(anchor)}. Regularize no Portal do Cliente para manter o acesso.`;
    } else if (r.offset === 0) {
      mensagem = `Hoje é o vencimento da sua assinatura${sub.plano_nome ? ` (${sub.plano_nome})` : ''}. Confira faturas no Portal do Cliente.`;
    } else {
      mensagem = `Sua próxima cobrança vence em ${formatPtDate(anchor)} (${r.offset} dia${r.offset > 1 ? 's' : ''}).`;
    }

    const codigo = `${r.codigo}_${dk}`;
    await upsertNotification(usuarioId, {
      tipo: 'cobranca',
      titulo: r.titulo,
      mensagem,
      codigo,
      metadata: { dias: diasCob, vencimento: dk, status: sub.status },
    });
    created += 1;
  }

  if (sub.status === 'atrasada') {
    const codigo = `assinatura_atrasada_${dk || 'geral'}`;
    await upsertNotification(usuarioId, {
      tipo: 'cobranca',
      titulo: 'Pagamento em atraso',
      mensagem:
        'Identificamos pendência na sua assinatura. Atualize o pagamento no Portal do Cliente.',
      codigo,
      metadata: { status: 'atrasada' },
    });
    created += 1;
  }

  return { created };
}
