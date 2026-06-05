/**
 * Testes Etapa 8.0 / 8.1 — Release Candidate e Go Live Billing
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
import { runProductionChecks } from './homologacao/productionCheck.js';
import { getGoLiveStatus } from './homologacao/goLiveStatus.js';
import { listRecentPayments } from './homologacao/billingAudit.js';
import { getSmtpAuditDetail } from './emailProvider.js';
import {
  createCheckout,
  processMercadoPagoWebhook,
  adminReenviarCobranca,
} from './billing/billingService.js';
import { ensureAssinaturaPadrao } from './billing/subscriptions.js';
import { setMockPixScenario } from './billing/pixSandbox.js';

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
    'server/homologacao/billingAudit.js',
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
  const mpCrit = rc.checks.find((c) => c.id === 'mercado_pago');
  const mpWh = rc.checks.find((c) => c.id === 'mp_webhook');
  const emailCrit = rc.checks.find((c) => c.id === 'email');
  const waWarn = rc.checks.find((c) => c.id === 'whatsapp');
  assert(mpCrit?.severity === 'critical', 'MP severidade crítica');
  assert(mpWh?.severity === 'critical', 'webhook MP severidade crítica');
  assert(emailCrit?.severity === 'critical', 'email severidade crítica');
  assert(waWarn?.severity === 'warning', 'WhatsApp severidade aviso');
  assert(rc.smtp?.variables_required?.length >= 1, 'auditoria SMTP');

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

  console.log('\n— go-live billing 8.1 —');
  await patchPaymentConfig('mercado_pago', {
    config: { access_token: 'TEST_GL_81', public_key: 'TEST_PUBLIC_81' },
    active: true,
  });
  await activateProvider('mercado_pago');

  const prod = await runProductionChecks({});
  const gwCheck = prod.checks.find((c) => c.id === 'gateway');
  assert(gwCheck?.detail?.includes('Mercado Pago'), 'production-check prioriza MP');
  assert(!prod.checks.some((c) => c.id === 'asaas' && !c.warnOnly), 'Asaas não bloqueia com MP');

  const gl = await getGoLiveStatus();
  assert(gl.billing.gateway === 'mercado_pago', 'go-live billing gateway MP');
  assert(gl.webhook.gateway === 'mercado_pago', 'go-live webhook MP');

  const smtp = getSmtpAuditDetail();
  assert(smtp.provider_expected, 'SMTP provider esperado');
  assert(smtp.variables, 'SMTP variáveis listadas');

  console.log('\n— fluxo trial → PIX → assinatura —');
  const flowEmail = `flow81_${TS}@fluxiva.test`;
  const flowHash = await bcrypt.hash('Test81!flow', 10);
  const { rows: flowU } = await query(
    `INSERT INTO usuarios (email, nome, senha_hash, role, tipo_perfil, nome_perfil, ativo)
     VALUES ($1, 'Flow 81', $2, 'user', 'fisica', 'PF', true) RETURNING id`,
    [flowEmail, flowHash]
  );
  const flowUserId = flowU[0].id;
  await ensureAssinaturaPadrao(flowUserId);

  const { rows: trialBefore } = await query(
    `SELECT status, trial_ate FROM assinaturas WHERE usuario_id = $1`,
    [flowUserId]
  );
  assert(trialBefore[0]?.status === 'trial', 'usuário inicia em trial');

  const checkout = await createCheckout(flowUserId, 'pf_basico', {
    metodo: 'pix',
    gateway: 'mercado_pago',
  });
  assert(checkout.ok, 'checkout PIX trial');
  const payId = checkout.gateway_payment_id;

  setMockPixScenario(payId, 'approved');
  const body = { action: 'payment.approved', data: { id: payId }, type: 'payment' };
  const w1 = await processMercadoPagoWebhook(body, { topic: 'payment', id: payId });
  assert(w1.activated, 'webhook ativa assinatura');
  const wDup = await processMercadoPagoWebhook(body, { topic: 'payment', id: payId });
  assert(wDup.duplicate, 'webhook duplicado idempotente');

  const { rows: subAfter } = await query(
    `SELECT status, trial_ate, proxima_cobranca FROM assinaturas WHERE usuario_id = $1`,
    [flowUserId]
  );
  assert(subAfter[0]?.status === 'ativa', 'assinatura ativa pós-pagamento');
  assert(!subAfter[0]?.trial_ate, 'trial encerrado');
  assert(subAfter[0]?.proxima_cobranca, 'próxima cobrança definida');

  const { rows: fatPaid } = await query(
    `SELECT status, pago_em FROM faturas WHERE id = $1`,
    [checkout.fatura_id]
  );
  assert(fatPaid[0]?.status === 'paga', 'fatura paga');
  assert(fatPaid[0]?.pago_em, 'pago_em gravado');

  const { rows: pagConf } = await query(
    `SELECT status FROM pagamentos WHERE gateway_payment_id = $1`,
    [payId]
  );
  assert(pagConf[0]?.status === 'confirmado', 'pagamento confirmado');

  console.log('\n— reenviar cobrança sem duplicar fatura —');
  const reEmail = `reenv81_${TS}@fluxiva.test`;
  const { rows: reU } = await query(
    `INSERT INTO usuarios (email, nome, senha_hash, role, tipo_perfil, nome_perfil, ativo)
     VALUES ($1, 'Reenv 81', $2, 'user', 'fisica', 'PF', true) RETURNING id`,
    [reEmail, flowHash]
  );
  const reUserId = reU[0].id;
  await ensureAssinaturaPadrao(reUserId);
  const chkRe = await createCheckout(reUserId, 'pf_basico', {
    metodo: 'pix',
    gateway: 'mercado_pago',
  });
  assert(chkRe.ok, 'checkout para reenviar');
  const fatId = chkRe.fatura_id;

  const { rows: admRe } = await query(
    `INSERT INTO usuarios (email, nome, senha_hash, role, tipo_perfil, ativo)
     VALUES ($1, 'AdmRe81', $2, 'admin', 'juridica', true) RETURNING id`,
    [`admre81_${TS}@fluxiva.test`, flowHash]
  );
  const re1 = await adminReenviarCobranca(reUserId, admRe[0].id);
  assert(re1.ok && re1.reenviado, 'reenviar ok');
  const re2 = await adminReenviarCobranca(reUserId, admRe[0].id);
  assert(re2.ok, 'segundo reenviar ok');
  const { rows: fatCount } = await query(
    `SELECT COUNT(*)::int AS n FROM faturas WHERE usuario_id = $1 AND status = 'pendente'`,
    [reUserId]
  );
  assert(fatCount[0].n === 1, 'reenviar não duplica fatura pendente');
  assert(re1.fatura_id === fatId && re2.fatura_id === fatId, 'mesma fatura');

  console.log('\n— auditoria últimos pagamentos —');
  const audit = await listRecentPayments({ limit: 10 });
  assert(audit.length >= 1, 'lista pagamentos');
  assert(audit[0].cliente?.email, 'auditoria com cliente');
  assert(audit[0].gateway, 'auditoria com gateway');

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

  const auditApi = await req('/admin/billing-audit', { token: adminToken });
  assert(Array.isArray(auditApi.data.pagamentos), 'GET billing-audit');

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

  console.log('\n=== Todos os testes 8.0/8.1 passaram ===\n');
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
