import { getEmailConfigStatus } from '../emailProvider.js';
import { isWhatsappGatewayConfigured } from '../authSecurity/otp.js';
import { getModuleStatus } from '../openFinance/connectionService.js';

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

export async function getSystemConfigStatus() {
  const email = getEmailConfigStatus();
  const whatsapp = getWhatsappConfigStatus();
  const billing = getBillingConfigStatus();
  const of = await getModuleStatus();

  return {
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
    openFinance: {
      configured: Boolean(of.realProviderConfigured && !of.demoMode),
      provider: of.provider,
      demoMode: of.demoMode,
      message: of.demoMode
        ? 'Open Finance em modo demo.'
        : of.message,
    },
  };
}
