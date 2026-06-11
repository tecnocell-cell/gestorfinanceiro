/**
 * whatsappNotifications.js — Notificações de billing via WhatsApp.
 *
 * Usa a instância admin PF (whatsapp_admin_instance) para enviar mensagens
 * aos usuários. Busca o número principal cadastrado em whatsapp_authorized_numbers.
 *
 * Fire-and-forget: falhas de envio são logadas mas nunca propagadas.
 */

import { query } from '../db.js';
import { sendText } from '../whatsapp/evolutionProvider.js';
import { DIV, BOT_AVATAR } from '../whatsapp/financePending.js';

const LABEL = '[billing/whatsapp]';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getAdminInstance() {
  const { rows } = await query(
    "SELECT value FROM system_config WHERE key = 'whatsapp_admin_instance' LIMIT 1"
  );
  return rows[0]?.value || null;
}

async function getNumeroUsuario(usuarioId) {
  const { rows } = await query(
    `SELECT phone_number
       FROM whatsapp_authorized_numbers
      WHERE usuario_id = $1
      ORDER BY created_at ASC
      LIMIT 1`,
    [usuarioId]
  );
  return rows[0]?.phone_number || null;
}

function fmtMoney(centavos) {
  if (!centavos) return 'R$ 0,00';
  const n = Number(centavos) / 100;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(iso) {
  if (!iso) return '';
  const parts = String(iso).slice(0, 10).split('-');
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// ── Mensagens ────────────────────────────────────────────────────────────────

function msgFaturaGerada({ planoNome, valorCentavos, vencimento }) {
  return (
    `${BOT_AVATAR}\n` +
    `🔔 *Nova fatura gerada*\n\n` +
    `  📦 Plano       ${planoNome || 'Fluxiva'}\n` +
    `  💰 Valor       ${fmtMoney(valorCentavos)}\n` +
    `  📅 Vencimento  ${fmtDate(vencimento)}\n` +
    `${DIV}\n` +
    `Acesse o app para pagar e manter seu acesso ativo.\n` +
    `_Fluxiva — Gestão Financeira_`
  );
}

function msgContaVencendo({ planoNome, diasRestantes }) {
  const urgencia = diasRestantes <= 1 ? '🚨' : diasRestantes <= 3 ? '⚠️' : '🔔';
  const prazo = diasRestantes <= 0
    ? '*hoje*'
    : diasRestantes === 1
      ? '*amanhã*'
      : `em *${diasRestantes} dias*`;

  return (
    `${BOT_AVATAR}\n` +
    `${urgencia} *Sua assinatura vence ${prazo}*\n\n` +
    `  📦 Plano  ${planoNome || 'Fluxiva'}\n` +
    `${DIV}\n` +
    `Renove agora para não perder o acesso.\n\n` +
    `💳 Responda *mensalidade* para pagar pelo WhatsApp\n` +
    `   (PIX com QR code ou link para cartão)`
  );
}

// ── Envio ────────────────────────────────────────────────────────────────────

async function enviarParaUsuario(usuarioId, texto) {
  try {
    const [instanceName, numero] = await Promise.all([
      getAdminInstance(),
      getNumeroUsuario(usuarioId),
    ]);

    if (!instanceName) {
      console.warn(`${LABEL} instância admin não configurada`);
      return false;
    }
    if (!numero) {
      console.warn(`${LABEL} usuário ${usuarioId} sem número autorizado`);
      return false;
    }

    await sendText(instanceName, numero, texto);
    console.log(`${LABEL} enviado para ${usuarioId} (${numero})`);
    return true;
  } catch (err) {
    console.warn(`${LABEL} falha ao enviar para ${usuarioId}:`, err.message);
    return false;
  }
}

// ── API pública ──────────────────────────────────────────────────────────────

/**
 * Notifica o usuário que uma nova fatura foi gerada.
 * Fire-and-forget — nunca lança exceção.
 */
export function notificarFaturaGerada(usuarioId, { planoNome, valorCentavos, vencimento }) {
  const texto = msgFaturaGerada({ planoNome, valorCentavos, vencimento });
  enviarParaUsuario(usuarioId, texto).catch(() => {});
}

/**
 * Notifica o usuário que a assinatura está próxima do vencimento.
 * Fire-and-forget — nunca lança exceção.
 */
export function notificarContaVencendo(usuarioId, { planoNome, diasRestantes }) {
  const texto = msgContaVencendo({ planoNome, diasRestantes });
  enviarParaUsuario(usuarioId, texto).catch(() => {});
}
