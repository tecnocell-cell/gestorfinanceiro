/**
 * billingRenewalJob.js — Job diário de renovação de assinaturas Fluxiva.
 *
 * Responsabilidade:
 *   - Buscar assinaturas ativas cuja `proxima_cobranca` já chegou
 *   - Gerar fatura pendente para o próximo ciclo (sem duplicar)
 *   - Enviar e-mail de cobrança
 *   - Avançar `proxima_cobranca` para o próximo período
 *   - Logar cada operação com resultado claro
 *
 * Ativação:
 *   - Automática: 1× ao dia via setInterval (sem node-cron)
 *   - Boot: executa após 45 s para não atrasar o startup
 *   - Desativar: BILLING_RENEWAL_JOB_ENABLED=false
 *
 * Segurança:
 *   - Admins ignorados (role = 'admin')
 *   - Duplicidade bloqueada por janela de ±7 dias na `proxima_cobranca`
 *   - Erro em 1 usuário não derruba o loop
 */

import { query } from '../db.js';
import { createRenewalInvoice } from './billingService.js';
import { emailCobrancaCriada } from './billingEmails.js';
import { logBillingOp } from './billingOpsLog.js';

const JOB_LABEL = '[billing/renewal-job]';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const BOOT_DELAY_MS = 45_000; // 45 s após o start

// ── Helpers de data ──────────────────────────────────────────────────────────

function formatDateYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Avança a data pela periodicidade do plano (mensal/anual). */
function nextBillingDate(from, intervalo) {
  const d = new Date(from);
  if (intervalo === 'anual') {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}

// ── Verificação de duplicidade ────────────────────────────────────────────────

/**
 * Retorna true se já existe fatura pendente/paga dentro de ±7 dias
 * da `proxima_cobranca`, evitando gerar fatura duplicada para o mesmo ciclo.
 */
async function faturaJaExisteParaCiclo(assinaturaId, proximaCobranca) {
  const ref = new Date(proximaCobranca);
  const inicio = formatDateYmd(new Date(ref.getTime() - 7 * 24 * 60 * 60 * 1000));
  const fim = formatDateYmd(new Date(ref.getTime() + 7 * 24 * 60 * 60 * 1000));

  const { rows } = await query(
    `SELECT id FROM faturas
     WHERE assinatura_id = $1
       AND status IN ('pendente', 'paga')
       AND vencimento BETWEEN $2 AND $3
     LIMIT 1`,
    [assinaturaId, inicio, fim]
  );
  return rows.length > 0;
}

// ── Core do job ───────────────────────────────────────────────────────────────

/**
 * Processa um único usuário:
 *   1. Verifica duplicidade
 *   2. Gera fatura via createRenewalInvoice
 *   3. Avança proxima_cobranca
 *   4. Envia e-mail
 *
 * @returns {{ status: 'gerada'|'ignorada'|'erro', motivo?: string }}
 */
async function processarUsuario(row) {
  const { usuario_id, assinatura_id, proxima_cobranca, plano_intervalo, plano_nome, plano_preco } =
    row;

  // 1. Anti-duplicidade
  const jaExiste = await faturaJaExisteParaCiclo(assinatura_id, proxima_cobranca);
  if (jaExiste) {
    return { status: 'ignorada', motivo: 'fatura já existe para este ciclo' };
  }

  // 2. Gerar fatura
  const resultado = await createRenewalInvoice(usuario_id);
  if (!resultado.ok) {
    return { status: 'erro', motivo: resultado.error };
  }

  // 3. Avançar proxima_cobranca
  const proxima = nextBillingDate(new Date(proxima_cobranca), plano_intervalo);
  await query(
    `UPDATE assinaturas SET proxima_cobranca = $1, updated_at = NOW() WHERE id = $2`,
    [proxima.toISOString(), assinatura_id]
  );

  // 4. E-mail (fire-and-forget — não bloqueia se SMTP ausente)
  emailCobrancaCriada(usuario_id, {
    planoNome: plano_nome || 'Fluxiva',
    valorCentavos: plano_preco,
    vencimento: proxima_cobranca,
    invoiceUrl: null,
  }).catch((err) => {
    console.warn(`${JOB_LABEL} e-mail falhou para ${usuario_id}:`, err.message);
  });

  await logBillingOp('renovacao_gerada', {
    usuarioId: usuario_id,
    faturaId: resultado.fatura_id,
    detalhes: { proxima_anterior: proxima_cobranca, proxima_nova: formatDateYmd(proxima) },
  });

  return { status: 'gerada', fatura_id: resultado.fatura_id };
}

// ── Execução do job ───────────────────────────────────────────────────────────

/**
 * Executa o job completo.
 * Retorna relatório: { processados, geradas, ignoradas, erros, detalhes[] }
 */
export async function runRenewalJob() {
  const inicio = Date.now();
  console.log(`${JOB_LABEL} iniciando...`);

  // Busca todas as assinaturas ativas cuja proxima_cobranca já chegou
  // Exclui admins (role = 'admin') por segurança
  const { rows } = await query(
    `SELECT
       a.id             AS assinatura_id,
       a.usuario_id,
       a.proxima_cobranca,
       p.intervalo      AS plano_intervalo,
       p.nome           AS plano_nome,
       p.preco_centavos AS plano_preco
     FROM assinaturas a
     JOIN planos p ON p.id = a.plano_id
     JOIN usuarios u ON u.id = a.usuario_id
     WHERE a.status = 'ativa'
       AND a.proxima_cobranca IS NOT NULL
       AND a.proxima_cobranca::date <= CURRENT_DATE
       AND u.role != 'admin'
       AND u.ativo = true
     ORDER BY a.proxima_cobranca ASC`
  );

  const total = rows.length;
  console.log(`${JOB_LABEL} ${total} assinatura(s) elegível(is)`);

  const resultado = { processados: total, geradas: 0, ignoradas: 0, erros: 0, detalhes: [] };

  for (const row of rows) {
    try {
      const r = await processarUsuario(row);
      resultado.detalhes.push({ usuario_id: row.usuario_id, ...r });

      if (r.status === 'gerada') resultado.geradas += 1;
      else if (r.status === 'ignorada') resultado.ignoradas += 1;
      else resultado.erros += 1;

      console.log(
        `${JOB_LABEL} ${row.usuario_id} → ${r.status}${r.motivo ? ` (${r.motivo})` : ''}`
      );
    } catch (err) {
      resultado.erros += 1;
      resultado.detalhes.push({ usuario_id: row.usuario_id, status: 'erro', motivo: err.message });
      console.error(`${JOB_LABEL} erro em ${row.usuario_id}:`, err.message);
    }
  }

  const ms = Date.now() - inicio;
  console.log(
    `${JOB_LABEL} concluído em ${ms}ms — ` +
      `geradas=${resultado.geradas} ignoradas=${resultado.ignoradas} erros=${resultado.erros}`
  );

  return resultado;
}

// ── Agendamento automático ────────────────────────────────────────────────────

/**
 * Inicia o job no boot.
 *   - Primeira execução: após BOOT_DELAY_MS (45 s) — evita concorrer com migrations
 *   - Recorrência: a cada 24 h
 *   - Desativar: BILLING_RENEWAL_JOB_ENABLED=false
 */
export function startRenewalJobScheduler() {
  // eslint-disable-next-line no-undef
  if (process.env.BILLING_RENEWAL_JOB_ENABLED === 'false') {
    console.log(`${JOB_LABEL} desativado via BILLING_RENEWAL_JOB_ENABLED=false`);
    return;
  }

  console.log(
    `${JOB_LABEL} agendado — primeira execução em ${BOOT_DELAY_MS / 1000}s, depois 1×/dia`
  );

  setTimeout(async () => {
    try {
      await runRenewalJob();
    } catch (err) {
      console.error(`${JOB_LABEL} erro no boot:`, err.message);
    }

    setInterval(async () => {
      try {
        await runRenewalJob();
      } catch (err) {
        console.error(`${JOB_LABEL} erro no intervalo:`, err.message);
      }
    }, MS_PER_DAY);
  }, BOOT_DELAY_MS);
}
