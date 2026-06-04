/**
 * Testes Etapa 7.5 — Homologação comercial e beta fechado
 * npm run test:75
 */
import { config } from 'dotenv';
config();

import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { query, pool } from './db.js';
import { runMigrations } from './migrate.js';
import { runProductionChecks } from './homologacao/productionCheck.js';
import { getBetaHomologacao, setBetaHomologacaoItem, BETA_ITEMS_PF } from './homologacao/betaChecklist.js';
import { getGoLiveStatus } from './homologacao/goLiveStatus.js';
import { logBillingOp, BILLING_OPS_TYPES, listBillingOpsLog } from './billing/billingOpsLog.js';

process.env.BILLING_USE_MOCK_GATEWAY = 'true';

const BASE = `http://127.0.0.1:${process.env.PORT || 3001}/api`;
const TS = Date.now();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !opts.allowError) {
    throw new Error(`${path} → ${res.status}: ${data.error || res.statusText}`);
  }
  return { status: res.status, data };
}

async function waitApi() {
  for (let i = 0; i < 25; i++) {
    try {
      if ((await fetch(`${BASE}/status`)).ok) return;
    } catch {
      /* */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('API offline');
}

async function main() {
  console.log('=== Testes Etapa 7.5 ===\n');
  await runMigrations();

  console.log('— scripts/check-production.sh —');
  assert(existsSync(join(ROOT, 'scripts/check-production.sh')), 'check-production.sh existe');
  assert(existsSync(join(ROOT, 'server/homologacao/runProductionCheck.js')), 'runProductionCheck.js existe');

  console.log('\n— checklist produção (lib) —');
  const prod = await runProductionChecks({});
  assert(Array.isArray(prod.checks), 'checks array');
  assert(prod.checks.some((c) => c.id === 'api'), 'check API');
  assert(prod.checks.some((c) => c.id === 'migrations'), 'check migrations');
  assert(prod.checks.some((c) => c.id === 'asaas'), 'check asaas');

  console.log('\n— billing ops log —');
  await logBillingOp(BILLING_OPS_TYPES.CHECKOUT_CRIADO, {
    detalhes: { test: true, ts: TS },
  });
  const logs = await listBillingOpsLog({ limit: 5 });
  assert(logs.length >= 1, 'billing_ops_log persiste');

  console.log('\n— beta homologação —');
  const beta0 = await getBetaHomologacao();
  assert(beta0.pf.length === BETA_ITEMS_PF.length, 'itens PF checklist');
  assert(beta0.pj.length >= 7, 'itens PJ checklist');
  const beta1 = await setBetaHomologacaoItem({
    segment: 'pf',
    key: 'cadastro',
    checked: true,
    adminEmail: 'admin@test.local',
  });
  assert(beta1.ok, 'marcar item beta');
  assert(beta1.pf.find((i) => i.key === 'cadastro')?.checked, 'cadastro marcado');

  console.log('\n— go-live status (lib) —');
  const gl = await getGoLiveStatus();
  assert(gl.email, 'go-live email');
  assert(gl.billing, 'go-live billing');
  assert(gl.webhook?.url?.includes('/api/billing/webhook/asaas'), 'webhook URL');
  assert(gl.whatsapp, 'go-live whatsapp');
  assert(Array.isArray(gl.recentOps), 'recentOps');

  await waitApi();

  const adminEmail = `admin_75_${TS}@test.local`;
  const pass = 'senha123';
  const hash = await bcrypt.hash(pass, 12);
  await query(
    `INSERT INTO usuarios (email, senha_hash, nome, role, ativo, tipo_perfil, nome_perfil, email_verificado)
     VALUES ($1,$2,'Admin 75','admin',true,'juridica','Admin',true)`,
    [adminEmail, hash]
  );
  const token = (await req('/auth/login', { method: 'POST', body: { email: adminEmail, senha: pass } })).data
    .token;

  console.log('\n— admin go-live API —');
  const { data: goLive } = await req('/admin/go-live', { token });
  assert(goLive.email, 'API go-live');
  assert(goLive.webhook.url, 'API webhook url');

  console.log('\n— admin production-check API —');
  const { data: pc } = await req('/admin/production-check', { token });
  assert(pc.checks?.length >= 6, 'production-check admin');

  console.log('\n— admin beta-homologacao API —');
  const { data: betaApi } = await req('/admin/beta-homologacao', { token });
  assert(betaApi.pf?.length, 'beta API GET');
  await req('/admin/beta-homologacao', {
    token,
    method: 'PATCH',
    body: { segment: 'pj', key: 'dre', checked: true },
  });
  const beta2 = await req('/admin/beta-homologacao', { token });
  assert(beta2.data.pj.find((i) => i.key === 'dre')?.checked, 'beta PATCH');

  await query('DELETE FROM usuarios WHERE email = $1', [adminEmail]);
  await query('DELETE FROM billing_ops_log WHERE detalhes::text LIKE $1', [`%${TS}%`]).catch(() => {});

  console.log('\n✅ test:75 OK\n');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  pool.end().finally(() => process.exit(1));
});
