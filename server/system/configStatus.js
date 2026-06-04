import { getEmailConfigStatus } from '../emailProvider.js';
import { isWhatsappGatewayConfigured } from '../authSecurity/otp.js';
import { getModuleStatus } from '../openFinance/connectionService.js';
import { isWebhookConfigured } from '../billing/gateways/asaas.js';
import { getBetaPublicConfig } from '../beta/betaConfig.js';

export function getBillingConfigStatus() {
  const configured = Boolean(process.env.ASAAS_API_KEY);
  const allowSimulate =
    process.env.BILLING_ALLOW_SIMULATE === 'true' ||
    process.env.NODE_ENV !== 'production';

  return {
    configured,
    gateway: 'asaas',
    allowSimulate,
    message: configured
      ? 'Cobrança real via Asaas configurada.'
      : 'Cobrança real não configurada.',
  };
}

export function getWhatsappConfigStatus() {
  const configured = isWhatsappGatewayConfigured();
  return {
    configured,
    message: configured
      ? 'Gateway WhatsApp (Evolution API) configurado.'
      : 'WhatsApp não configurado.',
  };
}

export function buildSystemAdminAlerts({ email, whatsapp, billing, openFinance }) {
  const alerts = [];
  if (!email.configured) {
    alerts.push({ id: 'smtp', severity: 'warn', message: 'SMTP não configurado' });
  }
  if (!billing.configured) {
    alerts.push({ id: 'billing', severity: 'warn', message: 'Cobrança não configurada' });
  }
  if (!whatsapp.configured) {
    alerts.push({ id: 'whatsapp', severity: 'warn', message: 'WhatsApp não configurado' });
  }
  if (openFinance.demoMode) {
    alerts.push({
      id: 'open_finance_demo',
      severity: 'info',
      message: 'Open Finance em modo demo',
    });
  }
  if (billing.configured && !isWebhookConfigured()) {
    alerts.push({ id: 'webhook_asaas', severity: 'warn', message: 'Webhook Asaas inativo' });
  }
  return alerts;
}

export async function getSystemConfigStatus() {
  const email = getEmailConfigStatus();
  const whatsapp = getWhatsappConfigStatus();
  const billing = getBillingConfigStatus();
  const of = await getModuleStatus();

  const openFinance = {
    configured: Boolean(of.realProviderConfigured && !of.demoMode),
    demoMode: of.demoMode,
    message: of.demoMode
      ? 'Open Finance em modo demo.'
      : of.message,
  };

  const payload = {
    email: {
      configured: email.configured,
      provider: email.provider,
      message: email.message,
    },
    whatsapp: {
      configured: whatsapp.configured,
      message: whatsapp.message,
    },
    billing: {
      configured: billing.configured,
      gateway: billing.gateway,
      allowSimulate: billing.allowSimulate,
      message: billing.message,
    },
    openFinance,
    beta: getBetaPublicConfig(),
    alerts: buildSystemAdminAlerts({ email, whatsapp, billing, openFinance }),
  };

  return payload;
}
