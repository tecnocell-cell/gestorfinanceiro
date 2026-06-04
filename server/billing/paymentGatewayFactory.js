/**
 * Seleção de gateway ativo — prioridade: Mercado Pago > Asaas > mock (Etapa 7.8)
 */
import { getPaymentConfigRow } from './paymentConfigService.js';
import { isMercadoPagoConfigured, isMercadoPagoActive } from './gateways/mercadoPago.js';
import { isAsaasConfigured, isAsaasRealKeyConfigured } from './gateways/asaas.js';

function useMock() {
  return process.env.BILLING_USE_MOCK_GATEWAY === 'true';
}

export async function isProviderActiveInDb(provider) {
  const row = await getPaymentConfigRow(provider);
  return Boolean(row?.active);
}

export async function isMercadoPagoReady() {
  if (!(await isMercadoPagoActive())) return false;
  return isMercadoPagoConfigured();
}

/** Mantém Asaas por env (legado) ou linha ativa em system_payment_config. */
export async function isAsaasReady() {
  const row = await getPaymentConfigRow('asaas');
  if (row?.active) return isAsaasConfigured();
  if (process.env.ASAAS_API_KEY || useMock()) return isAsaasConfigured();
  return false;
}

/**
 * Resolve gateway: preferred explícito ou prioridade MP > Asaas > mock
 */
export async function resolveActiveGateway(preferred) {
  if (preferred === 'mercado_pago' && (await isMercadoPagoReady())) return 'mercado_pago';
  if (preferred === 'asaas' && (await isAsaasReady())) return 'asaas';

  if (await isMercadoPagoReady()) return 'mercado_pago';
  if (await isAsaasReady()) return 'asaas';
  if (useMock()) return 'mock';
  return null;
}

export async function isPagamentosOnlineEnabled() {
  const gw = await resolveActiveGateway();
  return gw === 'mercado_pago' || gw === 'asaas' || gw === 'mock';
}

export function isCardPaymentEnabled() {
  return process.env.PAYMENT_CARD_ENABLED === 'true';
}

export async function getPublicPaymentMethods() {
  const mpReady = await isMercadoPagoReady();
  const asaasReady = await isAsaasReady();
  const mpRow = await getPaymentConfigRow('mercado_pago');
  const mpCfg = mpRow?.config || {};
  const cardEnv = isCardPaymentEnabled();
  const pagamentoOnline = mpReady || asaasReady;

  let gatewayAtivo = null;
  if (mpReady) gatewayAtivo = 'mercado_pago';
  else if (asaasReady) gatewayAtivo = 'asaas';

  return {
    pagamento_online: pagamentoOnline,
    gateway_ativo: gatewayAtivo,
    metodos: {
      pix: pagamentoOnline,
      cartao: mpReady && cardEnv && Boolean(mpCfg.public_key),
      boleto: false,
      boleto_em_breve: true,
    },
    cartao_em_teste: cardEnv && process.env.NODE_ENV !== 'production',
    public_key: mpReady && mpCfg.public_key ? mpCfg.public_key : null,
  };
}

export function publicGatewayName(gateway) {
  if (gateway === 'mercado_pago') return 'Pagamento online';
  if (gateway === 'asaas') return 'Pagamento online';
  return null;
}
