/**
 * Checklist de produção — Etapa 7.5
 */
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { query, pool } from '../db.js';
import { runMigrations } from '../migrate.js';
import { getEmailConfigStatus } from '../emailProvider.js';
import { getWhatsappConfigStatus } from '../system/configStatus.js';
import {
  isAsaasRealKeyConfigured,
  isWebhookConfigured,
  getAsaasEnv,
} from '../billing/gateways/asaas.js';
import { expectedWebhookUrl } from '../billing/billingHealthLib.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dir, '../migrations');

export function getBackupConfigStatus() {
  const configured = Boolean(
    process.env.BACKUP_ENABLED === 'true' ||
      process.env.BACKUP_S3_BUCKET ||
      process.env.BACKUP_CRON ||
      process.env.DATABASE_BACKUP_URL
  );
  return {
    configured,
    message: configured
      ? 'Backup configurado (variáveis de ambiente detectadas).'
      : 'Backup não configurado — defina BACKUP_ENABLED ou BACKUP_S3_BUCKET.',
  };
}

export async function checkMigrationsApplied() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const { rows } = await query('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.name));
  const pending = files.filter((f) => !applied.has(f));
  return {
    ok: pending.length === 0,
    total: files.length,
    applied: files.length - pending.length,
    pending,
  };
}

export async function checkAdminMaster() {
  const masters = (process.env.ADMIN_MASTER_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const { rows } = await query(
    `SELECT COUNT(*)::int AS n FROM usuarios WHERE role = 'admin' AND ativo = true`
  );
  const adminCount = rows[0]?.n || 0;
  if (masters.length) {
    const { rows: m } = await query(
      `SELECT email FROM usuarios WHERE role = 'admin' AND ativo = true`
    );
    const emails = m.map((r) => r.email?.toLowerCase());
    const found = masters.some((e) => emails.includes(e));
    return {
      ok: found && adminCount > 0,
      adminCount,
      mastersConfigured: masters.length,
      message: found
        ? 'Admin master configurado (ADMIN_MASTER_EMAILS).'
        : 'Nenhum e-mail de ADMIN_MASTER_EMAILS encontrado entre admins.',
    };
  }
  return {
    ok: adminCount > 0,
    adminCount,
    mastersConfigured: 0,
    message:
      adminCount > 0
        ? 'Existe conta admin (defina ADMIN_MASTER_EMAILS em produção).'
        : 'Nenhuma conta admin ativa.',
  };
}

export async function checkApiOnline(baseUrl) {
  const url = `${String(baseUrl).replace(/\/$/, '')}/api/status`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data.online !== false, url, status: res.status, data };
  } catch (err) {
    return { ok: false, url, error: err.message };
  }
}

export async function runProductionChecks({ apiBaseUrl } = {}) {
  const base =
    apiBaseUrl ||
    process.env.PUBLIC_API_URL ||
    process.env.API_PUBLIC_URL ||
    `http://127.0.0.1:${process.env.PORT || 3001}`;

  const email = getEmailConfigStatus();
  const whatsapp = getWhatsappConfigStatus();
  const backup = getBackupConfigStatus();
  const asaasConfigured = isAsaasRealKeyConfigured();
  const webhookUrl = expectedWebhookUrl();

  let migrations = { ok: false, pending: [], total: 0, applied: 0 };
  try {
    await runMigrations();
    migrations = await checkMigrationsApplied();
  } catch (err) {
    migrations = { ok: false, pending: [], error: err.message };
  }

  const adminMaster = await checkAdminMaster();
  const api = await checkApiOnline(base);

  const checks = [
    {
      id: 'api',
      label: 'API online',
      ok: api.ok,
      detail: api.ok ? api.url : api.error || `HTTP ${api.status}`,
    },
    {
      id: 'migrations',
      label: 'Migrations aplicadas',
      ok: migrations.ok,
      detail: migrations.ok
        ? `${migrations.applied}/${migrations.total} OK`
        : `Pendentes: ${(migrations.pending || []).join(', ') || migrations.error || '?'}`,
    },
    {
      id: 'email',
      label: 'E-mail configurado',
      ok: email.configured,
      detail: email.message,
    },
    {
      id: 'asaas',
      label: 'Asaas configurado',
      ok: asaasConfigured,
      detail: asaasConfigured
        ? `Ambiente ${getAsaasEnv()}`
        : 'ASAAS_API_KEY ausente ou mock ativo',
    },
    {
      id: 'webhook',
      label: 'Webhook URL pública',
      ok: Boolean(webhookUrl && (isWebhookConfigured() || process.env.NODE_ENV !== 'production')),
      detail: `${webhookUrl}${isWebhookConfigured() ? ' (token OK)' : ' (token opcional em dev)'}`,
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      ok: whatsapp.configured,
      detail: whatsapp.configured
        ? whatsapp.message
        : 'WhatsApp em ativação — lançamentos manuais disponíveis',
      warnOnly: !whatsapp.configured,
    },
    {
      id: 'admin_master',
      label: 'Admin master',
      ok: adminMaster.ok,
      detail: adminMaster.message,
    },
    {
      id: 'backup',
      label: 'Backup configurado',
      ok: backup.configured,
      detail: backup.message,
      warnOnly: !backup.configured,
    },
  ];

  const blocking = checks.filter((c) => !c.ok && !c.warnOnly);
  const warnings = checks.filter((c) => !c.ok && c.warnOnly);

  return {
    ok: blocking.length === 0,
    apiBase: base,
    checks,
    blockingCount: blocking.length,
    warningCount: warnings.length,
  };
}
