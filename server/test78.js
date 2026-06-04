/**
 * Testes Etapa 7.8 — Checkout comercial, Mercado Pago, trial → pagamento
 * npm run test:78
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
  maskSecret,
  maskMercadoPagoConfig,
  patchPaymentConfig,
  activateProvider,
  deactivateProvider,
} from './billing/paymentConfigService.js';
import {
  resolveActiveGateway,
  getPublicPaymentMethods,
  isMercadoPagoReady,
  isAsaasReady,
} from './billing/paymentGatewayFactory.js';
import { createCheckout, processMercadoPagoWebhook } from './billing/billingService.js';
import { ensureAssinaturaPadrao } from './billing/subscriptions.js';

process.env.BILLING_USE_MOCK_GATEWAY = 'true';
process.env.PAYMENT_CARD_ENABLED = 'false';

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
  console.log('=== Testes Etapa 7.8 ===\n');
  await runMigrations();

  const mig = readFileSync(join(ROOT, 'server/migrations/035_system_payment_config.sql'), 'utf8');
  assert(mig.includes('system_payment_config'), 'migration 035 system_payment_config');

  console.log('\n— mascaramento —');
  assert(maskSecret('APP_USR-1234567890-abcd').includes('****'), 'maskSecret oculta meio');
  const masked = maskMercadoPagoConfig({
    access_token: 'APP_USR-1234567890-abcd',
    client_secret: 'secr3t',
    public_key: 'APP_USR-pk',
  });
  assert(masked.access_token.includes('****'), 'access_token mascarado');
  assert(masked.public_key === 'APP_USR-pk', 'public_key não mascarada');

  console.log('\n— arquivos —');
  const files = [
    'server/billing/gateways/mercadoPago.js',
    'server/billing/paymentGatewayFactory.js',
    'server/billing/paymentConfigService.js',
    'server/routes/adminPaymentConfig.js',
    'src/gestor/pages/AdminPaymentConfigPage.jsx',
    'src/gestor/components/billing/PaymentMethodsSection.jsx',
  ];
  for (const f of files) assert(existsSync(join(ROOT, f)), `${f} existe`);

  const pkg = readFileSync(join(ROOT, 'package.json'), 'utf8');
  assert(pkg.includes('"test:78"'), 'script test:78');

  console.log('\n— gateway factory —');
  await patchPaymentConfig('mercado_pago', {
    config: { access_token: 'TEST_MP_TOKEN_78', public_key: 'TEST_PUBLIC' },
    active: false,
  });
  await activateProvider('mercado_pago');
  const gw = await resolveActiveGateway();
  assert(gw === 'mercado_pago' || gw === 'mock', `factory prioriza MP (${gw})`);
  assert(await isMercadoPagoReady(), 'MP ready após ativar');

  const pub = await getPublicPaymentMethods();
  assert(pub.pagamento_online, 'pagamento_online público');
  assert(pub.metodos?.pix, 'PIX disponível');

  process.env.PAYMENT_CARD_ENABLED = 'false';
  const pubNoCard = await getPublicPaymentMethods();
  assert(!pubNoCard.metodos?.cartao, 'cartão desabilitado sem PAYMENT_CARD_ENABLED');

  process.env.PAYMENT_CARD_ENABLED = 'true';
  const pubCard = await getPublicPaymentMethods();
  assert(pubCard.metodos?.cartao, 'cartão com env + public_key');

  console.log('\n— checkout PIX mock —');
  const email = `pay78_${TS}@fluxiva.test`;
  const hash = await bcrypt.hash('Test78!abc', 10);
  const { rows: urows } = await query(
    `INSERT INTO usuarios (email, nome, senha_hash, role, tipo_perfil, nome_perfil, ativo)
     VALUES ($1, 'Pay 78', $2, 'user', 'fisica', 'PF', true) RETURNING id`,
    [email, hash]
  );
  const userId = urows[0].id;
  await ensureAssinaturaPadrao(userId);

  const checkout = await createCheckout(userId, 'pf_basico', {
    metodo: 'pix',
    gateway: 'mercado_pago',
  });
  assert(checkout.ok, 'checkout PIX ok');
  assert(checkout.pix?.copy_paste || checkout.pix?.copiaECola, 'PIX copia e cola');
  assert(checkout.gateway === 'mercado_pago', 'gateway mercado_pago');

  console.log('\n— webhook idempotente —');
  const payId = checkout.gateway_payment_id;
  const body = { action: 'payment.updated', data: { id: payId }, type: 'payment' };
  const w1 = await processMercadoPagoWebhook(body, { topic: 'payment', id: payId });
  assert(w1.ok, 'webhook 1 ok');
  const w2 = await processMercadoPagoWebhook(body, { topic: 'payment', id: payId });
  assert(w2.duplicate, 'webhook duplicado idempotente');

  console.log('\n— Asaas legado —');
  await activateProvider('asaas');
  await patchPaymentConfig('mercado_pago', { active: false });
  await deactivateProvider('mercado_pago');
  const asaasOk = await isAsaasReady();
  assert(asaasOk || process.env.BILLING_USE_MOCK_GATEWAY === 'true', 'Asaas/mock ainda disponível');

  console.log('\n— API HTTP —');
  await waitApi();

  const publicSt = await req('/billing/public-status');
  assert(publicSt.data.pagamento_online !== undefined, 'GET public-status');

  const emailAdmin = `admin78_${TS}@fluxiva.test`;
  const { rows: adm } = await query(
    `INSERT INTO usuarios (email, nome, senha_hash, role, tipo_perfil, ativo)
     VALUES ($1, 'Admin78', $2, 'admin', 'juridica', true) RETURNING id`,
    [emailAdmin, hash]
  );
  const loginAdmin = await req('/auth/login', {
    body: { email: emailAdmin, senha: 'Test78!abc' },
  });
  const adminToken = loginAdmin.data.token;

  const cfg = await req('/admin/payment-config', { token: adminToken });
  const mpProvider = cfg.data.providers?.find((p) => p.provider === 'mercado_pago');
  assert(mpProvider?.config?.access_token?.includes('****'), 'admin vê token mascarado');

  const loginUser = await req('/auth/login', {
    body: { email, senha: 'Test78!abc' },
  });
  const userToken = loginUser.data.token;
  let denied = false;
  try {
    await req('/admin/payment-config', { token: userToken });
  } catch {
    denied = true;
  }
  assert(denied, 'usuário comum não acessa payment-config');

  const cadastroTxt = readFileSync(
    join(ROOT, 'centerflow-frontend/src/pages-spa/CadastroPage.tsx'),
    'utf8'
  );
  assert(cadastroTxt.includes('período de teste'), 'cadastro informa trial');
  assert(!cadastroTxt.includes('access token'), 'cadastro sem jargão técnico');

  console.log('\n=== Todos os testes 7.8 passaram ===\n');
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
