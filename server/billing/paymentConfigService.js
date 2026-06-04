/**
 * Configuração global de pagamentos (Super Admin) — Etapa 7.8
 * TODO: criptografar secrets em repouso quando utilitário de criptografia estiver disponível.
 */
import { query } from '../db.js';

const PROVIDERS = ['mercado_pago', 'asaas'];

const SECRET_FIELDS = {
  mercado_pago: ['access_token', 'client_secret', 'webhook_secret'],
  asaas: ['api_key', 'webhook_token'],
};

export function maskSecret(value) {
  if (!value || typeof value !== 'string') return '';
  if (value.length <= 12) return '****';
  return `${value.slice(0, 8)}****${value.slice(-4)}`;
}

export function maskMercadoPagoConfig(config = {}) {
  return {
    public_key: config.public_key || '',
    access_token: maskSecret(config.access_token),
    client_id: config.client_id || '',
    client_secret: maskSecret(config.client_secret),
    payer_email_fallback: config.payer_email_fallback || '',
    webhook_url: config.webhook_url || '',
    webhook_secret: maskSecret(config.webhook_secret),
    sandbox_mode: Boolean(config.sandbox_mode),
  };
}

export function maskAsaasConfig(config = {}) {
  return {
    api_key: maskSecret(config.api_key),
    env: config.env || 'sandbox',
    webhook_token: maskSecret(config.webhook_token),
    webhook_url: config.webhook_url || '',
    sandbox_mode: config.sandbox_mode !== false,
  };
}

function maskProviderConfig(provider, config) {
  if (provider === 'mercado_pago') return maskMercadoPagoConfig(config);
  if (provider === 'asaas') return maskAsaasConfig(config);
  return config;
}

export async function ensurePaymentConfigRows() {
  for (const provider of PROVIDERS) {
    await query(
      `INSERT INTO system_payment_config (provider, active, config)
       VALUES ($1, false, '{}'::jsonb)
       ON CONFLICT (provider) DO NOTHING`,
      [provider]
    );
  }
}

export async function listPaymentConfigMasked() {
  await ensurePaymentConfigRows();
  const { rows } = await query(
    `SELECT provider, active, config, updated_at FROM system_payment_config ORDER BY provider`
  );
  return rows.map((r) => ({
    provider: r.provider,
    active: r.active,
    config: maskProviderConfig(r.provider, r.config || {}),
    updated_at: r.updated_at,
  }));
}

export async function getPaymentConfigRow(provider) {
  await ensurePaymentConfigRows();
  const { rows } = await query(
    `SELECT * FROM system_payment_config WHERE provider = $1`,
    [provider]
  );
  return rows[0] || null;
}

export async function getActiveProvider() {
  const { rows } = await query(
    `SELECT provider FROM system_payment_config WHERE active = true ORDER BY updated_at DESC LIMIT 1`
  );
  return rows[0]?.provider || null;
}

function mergeSecrets(provider, incoming, existing) {
  const out = { ...(existing || {}), ...(incoming || {}) };
  for (const field of SECRET_FIELDS[provider] || []) {
    const val = incoming?.[field];
    if (typeof val === 'string' && val.includes('****')) {
      out[field] = existing?.[field] ?? '';
    }
  }
  return out;
}

export async function patchPaymentConfig(provider, { config, active }) {
  if (!PROVIDERS.includes(provider)) {
    return { ok: false, error: 'Provedor inválido.' };
  }
  const row = await getPaymentConfigRow(provider);
  if (!row) return { ok: false, error: 'Provedor não encontrado.' };

  const merged = config ? mergeSecrets(provider, config, row.config || {}) : row.config || {};
  const nextActive = active !== undefined ? Boolean(active) : row.active;

  await query(
    `UPDATE system_payment_config SET config = $1::jsonb, active = $2, updated_at = NOW() WHERE provider = $3`,
    [JSON.stringify(merged), nextActive, provider]
  );

  return { ok: true, provider, config: maskProviderConfig(provider, merged), active: nextActive };
}

export async function activateProvider(provider) {
  if (!PROVIDERS.includes(provider)) return { ok: false, error: 'Provedor inválido.' };
  await query(`UPDATE system_payment_config SET active = false, updated_at = NOW()`);
  await query(
    `UPDATE system_payment_config SET active = true, updated_at = NOW() WHERE provider = $1`,
    [provider]
  );
  return { ok: true, provider, active: true };
}

export async function deactivateProvider(provider) {
  await query(
    `UPDATE system_payment_config SET active = false, updated_at = NOW() WHERE provider = $1`,
    [provider]
  );
  return { ok: true, provider, active: false };
}

export async function getMercadoPagoConfigRaw() {
  const row = await getPaymentConfigRow('mercado_pago');
  return row?.config || {};
}

export async function getAsaasConfigRaw() {
  const row = await getPaymentConfigRow('asaas');
  const db = row?.config || {};
  return {
    api_key: db.api_key || process.env.ASAAS_API_KEY || '',
    env: db.env || process.env.ASAAS_ENV || 'sandbox',
    webhook_token: db.webhook_token || process.env.ASAAS_WEBHOOK_TOKEN || '',
    webhook_url: db.webhook_url || '',
    sandbox_mode: db.sandbox_mode !== false,
    active: Boolean(row?.active),
  };
}

export function gatewayProviderLabel(provider) {
  if (provider === 'mercado_pago') return 'Mercado Pago';
  if (provider === 'asaas') return 'Asaas';
  return 'Manual';
}

export function metodoPagamentoLabel(payload) {
  const p = typeof payload === 'string' ? JSON.parse(payload || '{}') : payload || {};
  if (p.metodo === 'cartao' || p.billingType === 'CREDIT_CARD') return 'Cartão';
  if (p.metodo === 'pix' || p.billingType === 'PIX' || p.pix) return 'PIX';
  return 'Manual';
}
