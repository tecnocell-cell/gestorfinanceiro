/**
 * Painel Admin Go-Live — Etapa 7.5 / 8.1 (Mercado Pago principal)
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
import { expectedWebhookUrl, expectedMpWebhookUrl, pingAsaas } from '../billing/billingHealthLib.js';
import { listBillingOpsLog } from '../billing/billingOpsLog.js';
import { isMercadoPagoActive, isMercadoPagoConfigured } from '../billing/gateways/mercadoPago.js';
import { isMercadoPagoReady } from '../billing/paymentGatewayFactory.js';
import { getPaymentConfigRow } from '../billing/paymentConfigService.js';
import { publicApiBaseUrl } from '../billing/billingUrls.js';

export async function getGoLiveStatus() {
  const email = getEmailConfigStatus();
  const whatsapp = getWhatsappConfigStatus();
  const backup = getBackupConfigStatus();
  const mpPrimary = await isMercadoPagoReady();
  const mpActive = await isMercadoPagoActive();
  const mpConfigured = await isMercadoPagoConfigured();
  const asaasConfigured = isAsaasRealKeyConfigured();

  let asaasPing = null;
  if (asaasConfigured && !mpPrimary) {
    asaasPing = await pingAsaas();
  }

  const mpRow = await getPaymentConfigRow('mercado_pago');
  const mpWebhookSecret = Boolean(mpRow?.config?.webhook_secret);
  const publicUrl = publicApiBaseUrl();

  let webhookErrors = [];
  const gatewayFilter = mpPrimary ? 'mercado_pago' : 'asaas';
  try {
    const { rows } = await query(
      `SELECT evento, idempotency_key, created_at,
              payload->>'error' AS err,
              payload->'data'->>'id' AS payment_id
       FROM eventos_pagamento
       WHERE gateway = $1
       ORDER BY created_at DESC
       LIMIT 30`,
      [gatewayFilter]
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

  const billingMessage = mpPrimary
    ? mpActive
      ? 'Mercado Pago ativo (gateway principal).'
      : 'Configure e ative Mercado Pago no Super Admin.'
    : asaasConfigured
      ? `Asaas ${getAsaasEnv()}${asaasPing?.ok ? ' — conexão OK' : ''}`
      : 'Cobrança real não configurada.';

  const webhookUrl = mpPrimary ? expectedMpWebhookUrl() : expectedWebhookUrl();
  const webhookTokenOk = mpPrimary
    ? Boolean(publicUrl && (mpWebhookSecret || process.env.NODE_ENV !== 'production'))
    : isWebhookConfigured();

  return {
    email: {
      configured: email.configured,
      provider: email.provider,
      message: email.configured
        ? 'E-mail transacional ativo.'
        : 'E-mail não configurado — OTP/cobrança usam fallback em dev.',
    },
    billing: {
      configured: mpPrimary ? mpActive : asaasConfigured,
      gateway: mpPrimary ? 'mercado_pago' : asaasConfigured ? 'asaas' : 'not_configured',
      environment: mpPrimary
        ? mpConfigured
          ? 'mercado_pago'
          : 'not_configured'
        : asaasConfigured
          ? getAsaasEnv()
          : 'not_configured',
      connectionOk: mpPrimary ? mpActive : asaasPing?.ok ?? null,
      connectionError: mpPrimary ? null : asaasPing?.error || null,
      message: billingMessage,
    },
    webhook: {
      url: webhookUrl,
      tokenConfigured: webhookTokenOk,
      gateway: mpPrimary ? 'mercado_pago' : 'asaas',
      message: mpPrimary
        ? publicUrl
          ? `Webhook MP: ${webhookUrl}`
          : 'Defina PUBLIC_API_URL para webhook Mercado Pago.'
        : isWebhookConfigured()
          ? 'Webhook Asaas com token configurado.'
          : 'Defina ASAAS_WEBHOOK_TOKEN em produção (legado).',
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
