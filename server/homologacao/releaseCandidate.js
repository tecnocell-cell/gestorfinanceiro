/**
 * Release Candidate — Etapa 8.0
 */
import { query } from '../db.js';
import { getEmailConfigStatus } from '../emailProvider.js';
import { getWhatsappConfigStatus } from '../system/configStatus.js';
import {
  checkAdminMaster,
  checkApiOnline,
  checkMigrationsApplied,
  getBackupConfigStatus,
} from './productionCheck.js';
import { runMigrations } from '../migrate.js';
import {
  isMercadoPagoActive,
  isMercadoPagoConfigured,
  createPixPayment,
  getPayment,
} from '../billing/gateways/mercadoPago.js';
import { getPaymentConfigRow } from '../billing/paymentConfigService.js';
import {
  expectedMpWebhookUrl,
  publicApiBaseUrl,
} from '../billing/billingUrls.js';

const RC_PIX_KEY = 'release_candidate_pix_test_v1';

export async function checkDatabaseOnline() {
  try {
    await query('SELECT 1 AS ok');
    return { ok: true, message: 'PostgreSQL respondendo.' };
  } catch (err) {
    return { ok: false, message: err.message || 'Banco indisponível.' };
  }
}

export async function runReleaseCandidateChecks({ apiBaseUrl } = {}) {
  const base =
    apiBaseUrl ||
    publicApiBaseUrl() ||
    process.env.PUBLIC_API_URL ||
    `http://127.0.0.1:${process.env.PORT || 3001}`;

  const email = getEmailConfigStatus();
  const whatsapp = getWhatsappConfigStatus();
  const backup = getBackupConfigStatus();
  const db = await checkDatabaseOnline();
  const adminMaster = await checkAdminMaster();
  const api = await checkApiOnline(base);
  const publicUrl = publicApiBaseUrl();

  let migrations = { ok: false, pending: [], total: 0, applied: 0 };
  try {
    await runMigrations();
    migrations = await checkMigrationsApplied();
  } catch (err) {
    migrations = { ok: false, pending: [], error: err.message };
  }

  const mpActive = await isMercadoPagoActive();
  const mpConfigured = await isMercadoPagoConfigured();
  const mpRow = await getPaymentConfigRow('mercado_pago');
  const mpWebhookSecret = Boolean(mpRow?.config?.webhook_secret);
  const mpWebhookUrl = expectedMpWebhookUrl();
  const mpWebhookOk =
    Boolean(publicUrl) && mpActive && (mpWebhookSecret || process.env.NODE_ENV !== 'production');

  const checks = [
    {
      id: 'api',
      label: 'API online',
      ok: api.ok,
      detail: api.ok ? api.url : api.error || `HTTP ${api.status}`,
      critical: false,
    },
    {
      id: 'database',
      label: 'Banco online',
      ok: db.ok,
      detail: db.message,
      critical: false,
    },
    {
      id: 'migrations',
      label: 'Migrations aplicadas',
      ok: migrations.ok,
      detail: migrations.ok
        ? `${migrations.applied}/${migrations.total} OK`
        : `Pendentes: ${(migrations.pending || []).join(', ') || migrations.error || '?'}`,
      critical: false,
    },
    {
      id: 'public_api_url',
      label: 'PUBLIC_API_URL configurado',
      ok: Boolean(publicUrl),
      detail: publicUrl || 'Defina PUBLIC_API_URL=https://financeiro.fluxiva.app',
      critical: true,
    },
    {
      id: 'mercado_pago',
      label: 'Mercado Pago ativo',
      ok: mpActive,
      detail: mpActive
        ? 'Gateway Mercado Pago ativo e configurado.'
        : mpConfigured
          ? 'Credenciais presentes — ative o provedor no Super Admin.'
          : 'Configure access token e ative Mercado Pago.',
      critical: true,
    },
    {
      id: 'mp_webhook',
      label: 'Webhook Mercado Pago configurado',
      ok: mpWebhookOk,
      detail: `${mpWebhookUrl}${mpWebhookSecret ? ' (segredo OK)' : ' — cadastre URL no painel MP'}`,
      critical: false,
    },
    {
      id: 'email',
      label: 'E-mail configurado',
      ok: email.configured,
      detail: email.message,
      critical: true,
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      ok: whatsapp.configured,
      detail: whatsapp.configured
        ? whatsapp.message
        : 'WhatsApp em ativação — lançamentos manuais disponíveis.',
      warnOnly: true,
      critical: false,
    },
    {
      id: 'backup',
      label: 'Backup configurado',
      ok: backup.configured,
      detail: backup.message,
      warnOnly: true,
      critical: false,
    },
    {
      id: 'admin_master',
      label: 'Admin master configurado',
      ok: adminMaster.ok,
      detail: adminMaster.message,
      critical: true,
    },
  ];

  const blocking = checks.filter((c) => !c.ok && !c.warnOnly);
  const warnings = checks.filter((c) => !c.ok && c.warnOnly);
  const criticalMissing = checks.filter((c) => c.critical && !c.ok).map((c) => c.label);

  return {
    ok: blocking.length === 0,
    ready: criticalMissing.length === 0,
    apiBase: base,
    publicApiUrl: publicUrl,
    mpWebhookUrl,
    checks,
    blockingCount: blocking.length,
    warningCount: warnings.length,
    criticalMissing,
  };
}

export async function getCriticalAlerts() {
  const rc = await runReleaseCandidateChecks({});
  return {
    ok: rc.criticalMissing.length === 0,
    alerts: rc.criticalMissing.map((label) => ({
      label,
      message: `${label} — pendente antes de clientes reais.`,
    })),
    checks: rc.checks.filter((c) => c.critical),
  };
}

async function readPixTest() {
  const { rows } = await query(`SELECT value FROM system_config WHERE key = $1`, [RC_PIX_KEY]);
  if (!rows.length) return null;
  try {
    return typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
  } catch {
    return null;
  }
}

async function writePixTest(data) {
  await query(
    `INSERT INTO system_config (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [RC_PIX_KEY, JSON.stringify(data)]
  );
}

async function withHomologationMock(fn) {
  const live = process.env.MP_PIX_SANDBOX_LIVE === 'true';
  if (live) return fn();
  const prev = process.env.BILLING_USE_MOCK_GATEWAY;
  process.env.BILLING_USE_MOCK_GATEWAY = 'true';
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.BILLING_USE_MOCK_GATEWAY;
    else process.env.BILLING_USE_MOCK_GATEWAY = prev;
  }
}

export async function createRcPixTest() {
  const mpActive = await isMercadoPagoActive();
  const mockOk =
    process.env.BILLING_USE_MOCK_GATEWAY === 'true' ||
    process.env.NODE_ENV !== 'production' ||
    process.env.MP_PIX_SANDBOX_LIVE !== 'true';
  if (!mpActive && !mockOk) {
    return { ok: false, error: 'Mercado Pago não está ativo. Configure no Super Admin.' };
  }

  const externalReference = `fluxiva:homologacao:${Date.now()}`;
  const payment = await withHomologationMock(() =>
    createPixPayment({
    valueReais: 0.01,
    description: 'Fluxiva RC — homologação PIX',
    externalReference,
      payerEmail: 'homologacao@fluxiva.app',
      dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    })
  );

  const test = {
    payment_id: payment.id,
    external_reference: externalReference,
    status: payment.status,
    created_at: new Date().toISOString(),
    valor_centavos: 1,
    homologacao: true,
    note: 'Cobrança de homologação — não ativa assinatura de cliente.',
    pix: {
      qr_code: payment.qrCode,
      qr_code_base64: payment.qrCodeBase64,
      copia_e_cola: payment.copiaECola,
      expires_at: payment.expiresAt,
    },
  };
  await writePixTest(test);

  return { ok: true, test };
}

export async function consultRcPixTest() {
  const stored = await readPixTest();
  if (!stored?.payment_id) {
    return { ok: false, error: 'Nenhum teste PIX em andamento. Gere uma cobrança de homologação.' };
  }
  try {
    const payment = await withHomologationMock(() => getPayment(stored.payment_id));
    const updated = {
      ...stored,
      status: payment.status,
      status_mp: payment.status,
      consulted_at: new Date().toISOString(),
    };
    await writePixTest(updated);
    return {
      ok: true,
      test: updated,
      homologacao: true,
      activates_subscription: false,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function getRcPixTest() {
  const stored = await readPixTest();
  return { ok: true, test: stored };
}

export async function getRcRecentWebhooks({ limit = 15 } = {}) {
  try {
    const { rows } = await query(
      `SELECT id, gateway, evento, idempotency_key, created_at, payload
       FROM eventos_pagamento
       WHERE gateway = 'mercado_pago'
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    return rows.map((r) => ({
      id: r.id,
      evento: r.evento,
      created_at: r.created_at,
      idempotency_key: r.idempotency_key,
    }));
  } catch {
    return [];
  }
}
