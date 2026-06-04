/**
 * E-mails transacionais de cobrança — Etapa 7.4 (não quebra se SMTP ausente)
 */
import { sendEmail } from '../emailProvider.js';
import { query } from '../db.js';

async function userEmail(usuarioId) {
  const { rows } = await query(`SELECT email, nome FROM usuarios WHERE id = $1`, [usuarioId]);
  return rows[0] || null;
}

function fmtBRL(centavos) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    (centavos || 0) / 100
  );
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

async function safeSend(usuarioId, subject, text, logLabel) {
  const u = await userEmail(usuarioId);
  if (!u?.email) {
    console.log(`[billing/email] ${logLabel}: sem e-mail para usuário ${usuarioId}`);
    return { sent: false };
  }
  try {
    const r = await sendEmail({
      to: u.email,
      subject,
      text: `Olá, ${u.nome || 'cliente'}!\n\n${text}\n\n— Equipe Fluxiva`,
      logLabel,
    });
    return r;
  } catch (err) {
    console.warn(`[billing/email] ${logLabel}:`, err.message);
    return { sent: false, error: err.message };
  }
}

export async function emailCobrancaCriada(usuarioId, { planoNome, valorCentavos, vencimento, invoiceUrl }) {
  return safeSend(
    usuarioId,
    'Fluxiva — Cobrança disponível',
    `Geramos sua cobrança do plano ${planoNome}.\nValor: ${fmtBRL(valorCentavos)}\nVencimento: ${fmtDate(vencimento)}${
      invoiceUrl ? `\nLink: ${invoiceUrl}` : ''
    }`,
    'COBRANÇA CRIADA'
  );
}

export async function emailPagamentoConfirmado(usuarioId, { planoNome }) {
  return safeSend(
    usuarioId,
    'Fluxiva — Pagamento confirmado',
    `Recebemos seu pagamento. Seu plano ${planoNome || ''} está ativo.`,
    'PAGAMENTO CONFIRMADO'
  );
}

export async function emailAssinaturaAtrasada(usuarioId) {
  return safeSend(
    usuarioId,
    'Fluxiva — Pagamento em atraso',
    'Identificamos pendência na sua assinatura. Regularize o PIX em aberto para manter todos os recursos.',
    'ASSINATURA ATRASADA'
  );
}

export async function emailAssinaturaCancelada(usuarioId, { acessoAte }) {
  return safeSend(
    usuarioId,
    'Fluxiva — Assinatura cancelada',
    `Sua assinatura foi cancelada. O acesso permanece até ${fmtDate(acessoAte)}.`,
    'ASSINATURA CANCELADA'
  );
}
