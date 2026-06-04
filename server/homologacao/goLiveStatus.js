/**
 * Painel Admin Go-Live — Etapa 7.5
 */
import { query } from '../db.js';
import { getEmailConfigStatus } from '../emailProvider.js';
import { getWhatsappConfigStatus } from '../system/configStatus.js';
import { getBackupConfigStatus } from './productionCheck.js';
import {
  isAsaasRealKeyConfigured,
  isWebhookConfigured,
  getAsaasEnv,
} from '../billing/gateways/asaas.js';
import { expectedWebhookUrl, pingAsaas } from '../billing/billingHealthLib.js';
import { listBillingOpsLog } from '../billing/billingOpsLog.js';

export async function getGoLiveStatus() {
  const email = getEmailConfigStatus();
  const whatsapp = getWhatsappConfigStatus();
  const backup = getBackupConfigStatus();
  const asaasConfigured = isAsaasRealKeyConfigured();

  let asaasPing = null;
  if (asaasConfigured) {
    asaasPing = await pingAsaas();
  }

  const webhookUrl = expectedWebhookUrl();

  let webhookErrors = [];
  try {
    const { rows } = await query(
      `SELECT evento, idempotency_key, created_at,
              payload->>'error' AS err,
              payload->'payment'->>'id' AS payment_id
       FROM eventos_pagamento
       WHERE gateway = 'asaas'
       ORDER BY created_at DESC
       LIMIT 30`
    );
    webhookErrors = rows
      .filter((r) => {
        const ev = r.evento || '';
        return ev.includes('UNKNOWN') || r.err;
      })
      .slice(0, 10)
      .map((r) => ({
        evento: r.evento,
        payment_id: r.payment_id,
        at: r.created_at,
        message: r.err || 'Evento não processado ou ignorado',
      }));
  } catch {
    webhookErrors = [];
  }

  let opsLog = [];
  try {
    opsLog = await listBillingOpsLog({ limit: 20 });
  } catch {
    opsLog = [];
  }

  const falhas = opsLog.filter((l) => l.tipo === 'pagamento_falha');

  return {
    email: {
      configured: email.configured,
      provider: email.provider,
      message: email.configured
        ? 'E-mail transacional ativo.'
        : 'E-mail não configurado — OTP/cobrança usam fallback em dev.',
    },
    billing: {
      configured: asaasConfigured,
      environment: asaasConfigured ? getAsaasEnv() : 'not_configured',
      connectionOk: asaasPing?.ok ?? null,
      connectionError: asaasPing?.error || null,
      message: asaasConfigured
        ? `Asaas ${getAsaasEnv()}${asaasPing?.ok ? ' — conexão OK' : ''}`
        : 'Cobrança real não configurada (mock ou sem chave).',
    },
    webhook: {
      url: webhookUrl,
      tokenConfigured: isWebhookConfigured(),
      message: isWebhookConfigured()
        ? 'Webhook com token configurado.'
        : 'Defina ASAAS_WEBHOOK_TOKEN em produção.',
    },
    whatsapp: {
      configured: whatsapp.configured,
      message: whatsapp.configured
        ? whatsapp.message
        : 'WhatsApp em ativação. Lançamentos manuais continuam disponíveis.',
    },
    backup: {
      configured: backup.configured,
      message: backup.message,
    },
    webhookErrors,
    recentOps: opsLog,
    paymentFailures: falhas.slice(0, 10),
  };
}
