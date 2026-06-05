/**
 * URLs públicas de cobrança — usa PUBLIC_API_URL (nunca localhost no painel admin).
 */
const PRODUCTION_API_BASE = 'https://financeiro.fluxiva.app';

export function publicApiBaseUrl() {
  const raw = process.env.PUBLIC_API_URL || process.env.API_PUBLIC_URL;
  if (raw) return String(raw).replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production') return PRODUCTION_API_BASE;
  return null;
}

export function expectedMpWebhookUrl() {
  const base = publicApiBaseUrl();
  const root = base || PRODUCTION_API_BASE;
  return `${root}/api/billing/webhook/mercado-pago`;
}

export function expectedAsaasWebhookUrl() {
  const base = publicApiBaseUrl();
  if (base) return `${base}/api/billing/webhook/asaas`;
  const fallback =
    process.env.NODE_ENV === 'production'
      ? PRODUCTION_API_BASE
      : `http://localhost:${process.env.PORT || 3001}`;
  return `${fallback}/api/billing/webhook/asaas`;
}
