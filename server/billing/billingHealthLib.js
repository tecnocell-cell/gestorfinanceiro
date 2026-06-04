/**
 * Lógica compartilhada de diagnóstico Asaas (CLI + testes)
 */
import {
  getAsaasEnv,
  isAsaasRealKeyConfigured,
  isWebhookConfigured,
} from './gateways/asaas.js';

export function expectedWebhookUrl() {
  const base = process.env.PUBLIC_API_URL || process.env.API_PUBLIC_URL || 'http://localhost:3001';
  return `${String(base).replace(/\/$/, '')}/api/billing/webhook/asaas`;
}

export async function pingAsaas() {
  const key = process.env.ASAAS_API_KEY;
  if (!key) return { ok: false, error: 'ASAAS_API_KEY ausente' };
  const base =
    getAsaasEnv() === 'production'
      ? 'https://api.asaas.com/api/v3'
      : 'https://sandbox.asaas.com/api/v3';
  const res = await fetch(`${base}/finance/balance`, {
    headers: { access_token: key },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data?.errors?.[0]?.description || res.statusText };
  }
  return { ok: true };
}

export async function runBillingHealthChecks({ createTestCharge = false } = {}) {
  const mock = process.env.BILLING_USE_MOCK_GATEWAY === 'true';
  const keyOk = Boolean(process.env.ASAAS_API_KEY);
  const env = keyOk ? getAsaasEnv() : mock ? 'mock' : 'not_configured';
  const webhookUrl = expectedWebhookUrl();

  const result = {
    mock,
    apiKeyPresent: keyOk,
    env,
    webhookTokenConfigured: isWebhookConfigured(),
    webhookUrl,
    connectionOk: null,
    realConfigured: isAsaasRealKeyConfigured(),
  };

  if (isAsaasRealKeyConfigured()) {
    const ping = await pingAsaas();
    result.connectionOk = ping.ok;
    result.connectionError = ping.error || null;
  }

  result.createTestCharge = createTestCharge;
  return result;
}
