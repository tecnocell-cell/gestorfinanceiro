/**
 * Testes Etapa 8.0 — Release Candidate e homologação final
 * npm run test:80
 */
import { config } from 'dotenv';
config();

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { query, pool } from './db.js';
import { runMigrations } from './migrate.js';
import {
  runReleaseCandidateChecks,
  createRcPixTest,
  consultRcPixTest,
  getCriticalAlerts,
} from './homologacao/releaseCandidate.js';
import { getClientChecklist, setClientChecklistItem, RC_ITEMS_PF, RC_ITEMS_PJ } from './homologacao/clientChecklist.js';
import { getProductionGuide, GUIDE_SECTIONS } from './homologacao/productionGuide.js';
import { sanitizePublicMessage } from './billing/planRules.js';
import { patchPaymentConfig, activateProvider } from './billing/paymentConfigService.js';

process.env.BILLING_USE_MOCK_GATEWAY = 'true';

const BASE = `http://127.0.0.1:${process.env.PORT || 3001}/api`;
const TS = Date.now();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function req(path, opts = {}) {
  const method = opts.method || (opts.body !== undefined ? 'POST' : 'GET');
  const res = await fetch(`${BASE}${path}`, {
    method,
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
  throw new Error('API offline — execute npm run server');
}

async function main() {
  console.log('=== Testes Etapa 8.0 — Release Candidate ===\n');
  await runMigrations();

  console.log('— arquivos —');
  const files = [
    'server/homologacao/releaseCandidate.js',
    'server/homologacao/clientChecklist.js',
    'server/homologacao/productionGuide.js',
    'server/routes/adminRelease.js',
    'server/test80.js',
    'src/gestor/pages/AdminReleaseCandidatePage.jsx',
    'src/gestor/pages/AdminProductionGuidePage.jsx',
    'src/gestor/admin/AdminCriticalAlerts.jsx',
  ];
  for (const f of files) assert(existsSync(join(ROOT, f)), `${f} existe`);

  const pkg = readFileSync(join(ROOT, 'package.json'), 'utf8');
  assert(pkg.includes('"test:80"'), 'script test:80');

  const nav = readFileSync(join(ROOT, 'src/gestor/admin/adminNav.js'), 'utf8');
  assert(nav.includes('admin-release'), 'nav Release Candidate');
  assert(nav.includes('admin-guia'), 'nav Guia de Produção');

  console.log('\n— release candidate checks —');
  const rc = await runReleaseCandidateChecks({});
  assert(Array.isArray(rc.checks), 'checks array');
  const ids = rc.checks.map((c) => c.id);
  for (const id of [
    'api',
    'database',
    'migrations',
    'public_api_url',
    'mercado_pago',
    'mp_webhook',
    'email',
    'whatsapp',
    'backup',
    'admin_master',
  ]) {
    assert(ids.includes(id), `check ${id}`);
  }
  assert(rc.mpWebhookUrl?.includes('/api/billing/webhook/mercado-pago'), 'webhook MP URL');

  console.log('\n— critical alerts —');
  const alerts = await getCriticalAlerts();
  assert(Array.isArray(alerts.alerts), 'alerts array');
  assert(typeof alerts.ok === 'boolean', 'alerts ok flag');

  console.log('\n— PIX homologação (sem assinatura) —');
  await patchPaymentConfig('mercado_pago', {
    config: { access_token: 'TEST_RC_80', public_key: 'TEST_PUBLIC_80' },
    active: true,
  });
  await activateProvider('mercado_pago');

  const pixCreate = await createRcPixTest();
  assert(pixCreate.ok, 'cria PIX homologação');
  assert(pixCreate.test?.homologacao === true, 'flag homologacao');
  assert(pixCreate.test?.pix?.copia_e_cola, 'copia e cola');
  assert(
    pixCreate.test.external_reference?.startsWith('fluxiva:homologacao:'),
    'external ref homologação'
  );

  const pixConsult = await consultRcPixTest();
  assert(pixConsult.ok, 'consulta status');
  assert(pixConsult.activates_subscription === false, 'não ativa assinatura');

  const { rows: fatHom } = await query(
    `SELECT COUNT(*)::int AS n FROM faturas WHERE gateway_invoice_id = $1`,
    [pixCreate.test.payment_id]
  );
  assert(fatHom[0].n === 0, 'sem fatura real para teste RC');

  console.log('\n— client checklist —');
  assert(RC_ITEMS_PF.length >= 8, 'itens PF');
  assert(RC_ITEMS_PJ.length >= 8, 'itens PJ');
  const cl = await getClientChecklist();
  assert(cl.pf.length === RC_ITEMS_PF.length, 'checklist PF');
  const patched = await setClientChecklistItem({
    segment: 'pf',
    key: 'cadastro',
    checked: true,
    adminEmail: 'admin@test',
  });
  assert(patched.ok && patched.pf.find((i) => i.key === 'cadastro')?.checked, 'patch checklist');

  console.log('\n— production guide —');
  const guide = await getProductionGuide();
  assert(guide.sections.length === GUIDE_SECTIONS.length, 'seções guia');
  assert(guide.status?.webhook_url, 'status webhook');

  console.log('\n— segurança visual —');
  assert(
    sanitizePublicMessage('Erro: MP_ACCESS_TOKEN invalid') !== 'Erro: MP_ACCESS_TOKEN invalid',
    'oculta access token'
  );
  assert(sanitizePublicMessage('sandbox mode') !== 'sandbox mode', 'oculta sandbox');
  assert(sanitizePublicMessage('mock gateway') !== 'mock gateway', 'oculta mock');
  assert(
    sanitizePublicMessage('webhook_secret missing') !== 'webhook_secret missing',
    'oculta webhook secret'
  );

  console.log('\n— API HTTP —');
  await waitApi();

  const hash = await bcrypt.hash('Test80!rc', 10);
  const { rows: adm } = await query(
    `INSERT INTO usuarios (email, nome, senha_hash, role, tipo_perfil, ativo)
     VALUES ($1, 'Admin80', $2, 'admin', 'juridica', true) RETURNING id`,
    [`admin80_${TS}@fluxiva.test`, hash]
  );
  const loginAdmin = await req('/auth/login', {
    body: { email: `admin80_${TS}@fluxiva.test`, senha: 'Test80!rc' },
  });
  const adminToken = loginAdmin.data.token;

  const rcApi = await req('/admin/release-candidate', { token: adminToken });
  assert(rcApi.data.checks?.length >= 10, 'GET release-candidate');

  const guideApi = await req('/admin/production-guide', { token: adminToken });
  assert(guideApi.data.sections?.length >= 5, 'GET production-guide');

  const pixApi = await req('/admin/release-candidate/pix-test', {
    method: 'POST',
    token: adminToken,
    body: {},
  });
  assert(pixApi.data.test?.payment_id, 'POST pix-test admin');

  let denied = false;
  try {
    await req('/admin/release-candidate', { token: loginAdmin.data.token });
  } catch {
    /* admin ok */
  }
  const emailUser = `user80_${TS}@fluxiva.test`;
  await query(
    `INSERT INTO usuarios (email, nome, senha_hash, role, tipo_perfil, ativo)
     VALUES ($1, 'User80', $2, 'user', 'fisica', true)`,
    [emailUser, hash]
  );
  const loginUser = await req('/auth/login', { body: { email: emailUser, senha: 'Test80!rc' } });
  try {
    await req('/admin/release-candidate', { token: loginUser.data.token });
  } catch {
    denied = true;
  }
  assert(denied, 'usuário comum não acessa release-candidate');

  console.log('\n=== Todos os testes 8.0 passaram ===\n');
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
