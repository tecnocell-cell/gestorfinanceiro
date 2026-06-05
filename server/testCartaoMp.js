/**
 * Testes Etapa 7.8A — Cartão Mercado Pago (Payment Brick + sandbox)
 * npm run test:cartao-mp
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
  patchPaymentConfig,
  activateProvider,
} from './billing/paymentConfigService.js';
import {
  getPublicPaymentMethods,
  isCardPaymentEnabled,
} from './billing/paymentGatewayFactory.js';
import { createCheckout } from './billing/billingService.js';
import { ensureAssinaturaPadrao } from './billing/subscriptions.js';
import {
  CARD_SANDBOX_TOKENS,
  resolveCardSandboxScenario,
  getMockPaymentById,
} from './billing/cardSandbox.js';
import {
  assertCardPaymentAllowed,
  createCardPayment,
} from './billing/gateways/mercadoPago.js';

process.env.BILLING_USE_MOCK_GATEWAY = 'true';
process.env.PAYMENT_CARD_ENABLED = 'true';

const TS = Date.now();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function createTestUser(suffix) {
  const email = `cartao_mp_${suffix}_${TS}@fluxiva.test`;
  const hash = await bcrypt.hash('TestCard!78', 10);
  const { rows } = await query(
    `INSERT INTO usuarios (email, nome, senha_hash, role, tipo_perfil, nome_perfil, ativo)
     VALUES ($1, $2, $3, 'user', 'fisica', 'PF', true) RETURNING id`,
    [email, `Card ${suffix}`, hash]
  );
  const userId = rows[0].id;
  await ensureAssinaturaPadrao(userId);
  return userId;
}

async function checkoutCard(userId, token, installments = 1) {
  return createCheckout(userId, 'pf_basico', {
    metodo: 'cartao',
    gateway: 'mercado_pago',
    cardToken: token,
    installments,
    payer: { email: `payer_${TS}@fluxiva.test` },
  });
}

async function faturaStatus(faturaId) {
  const { rows } = await query(`SELECT status FROM faturas WHERE id = $1`, [faturaId]);
  return rows[0]?.status;
}

async function assinaturaStatus(userId) {
  const { rows } = await query(
    `SELECT a.status, p.slug FROM assinaturas a JOIN planos p ON p.id = a.plano_id WHERE a.usuario_id = $1`,
    [userId]
  );
  return rows[0];
}

async function main() {
  console.log('=== Testes Etapa 7.8A — Cartão Mercado Pago ===\n');
  await runMigrations();

  console.log('— arquivos —');
  const files = [
    'server/billing/cardSandbox.js',
    'server/billing/gateways/mercadoPago.js',
    'src/gestor/components/billing/MercadoPagoPaymentBrick.jsx',
    'src/gestor/components/billing/CardPaymentSandbox.jsx',
    'src/gestor/components/billing/PaymentMethodsSection.jsx',
    'src/gestor/hooks/useMercadoPagoSdk.js',
  ];
  for (const f of files) assert(existsSync(join(ROOT, f)), `${f} existe`);

  const pkg = readFileSync(join(ROOT, 'package.json'), 'utf8');
  assert(pkg.includes('"test:cartao-mp"'), 'script test:cartao-mp');

  const envEx = readFileSync(join(ROOT, '.env.example'), 'utf8');
  assert(envEx.includes('PAYMENT_CARD_ENABLED'), '.env.example documenta PAYMENT_CARD_ENABLED');

  const paySection = readFileSync(
    join(ROOT, 'src/gestor/components/billing/PaymentMethodsSection.jsx'),
    'utf8'
  );
  assert(paySection.includes('Cartão em breve'), 'UI mostra "Cartão em breve"');
  assert(paySection.includes('MercadoPagoPaymentBrick'), 'Payment Brick integrado');
  assert(paySection.includes('CardPaymentSandbox'), 'sandbox integrado');

  const sdkHook = readFileSync(join(ROOT, 'src/gestor/hooks/useMercadoPagoSdk.js'), 'utf8');
  assert(sdkHook.includes('sdk.mercadopago.com/js/v2'), 'SDK oficial Mercado Pago v2');
  const brick = readFileSync(
    join(ROOT, 'src/gestor/components/billing/MercadoPagoPaymentBrick.jsx'),
    'utf8'
  );
  assert(brick.includes('create("payment"'), 'Payment Brick oficial');

  console.log('\n— cardSandbox —');
  const approved = resolveCardSandboxScenario(CARD_SANDBOX_TOKENS.approved);
  assert(approved.status === 'approved' && approved.scenario === 'approved', 'cenário aprovado');

  const rejected = resolveCardSandboxScenario(CARD_SANDBOX_TOKENS.rejected);
  assert(rejected.status === 'rejected' && rejected.scenario === 'rejected', 'cenário recusado');

  const inst = resolveCardSandboxScenario(CARD_SANDBOX_TOKENS.installments);
  assert(inst.status === 'approved' && inst.installments === 3, 'cenário parcelado 3x');

  const cancelled = resolveCardSandboxScenario(CARD_SANDBOX_TOKENS.cancelled);
  assert(cancelled.status === 'cancelled' && cancelled.scenario === 'cancelled', 'cenário cancelado');

  const mockPay = getMockPaymentById('pay_mp_mock_installments_123_abc');
  assert(mockPay.sandbox_scenario === 'installments', 'getMockPaymentById installments');

  console.log('\n— flags PAYMENT_CARD_ENABLED —');
  process.env.PAYMENT_CARD_ENABLED = 'false';
  assert(!isCardPaymentEnabled(), 'flag desligada por padrão');
  let blocked = false;
  try {
    assertCardPaymentAllowed();
  } catch (e) {
    blocked = e.message.includes('não está habilitado');
  }
  assert(blocked, 'backend bloqueia cartão sem PAYMENT_CARD_ENABLED');

  await patchPaymentConfig('mercado_pago', {
    config: { access_token: 'TEST_MP_CARD', public_key: 'TEST_PUBLIC_CARD' },
    active: true,
  });
  await activateProvider('mercado_pago');

  const pubOff = await getPublicPaymentMethods();
  assert(!pubOff.metodos?.cartao, 'portal sem cartão quando flag false');
  assert(pubOff.cartao_em_breve, 'cartao_em_breve quando indisponível');

  process.env.PAYMENT_CARD_ENABLED = 'true';
  const pubOn = await getPublicPaymentMethods();
  assert(pubOn.metodos?.cartao, 'cartão disponível com flag true + mock');
  assert(pubOn.cartao_sandbox, 'sandbox ativo com BILLING_USE_MOCK_GATEWAY');
  assert(!pubOn.cartao_brick || pubOn.public_key, 'brick ou sandbox conforme public_key');

  console.log('\n— produção bloqueada —');
  const savedEnv = process.env.NODE_ENV;
  const savedAllow = process.env.PAYMENT_CARD_ALLOW_PRODUCTION;
  process.env.NODE_ENV = 'production';
  process.env.PAYMENT_CARD_ALLOW_PRODUCTION = 'false';
  let prodBlocked = false;
  try {
    assertCardPaymentAllowed();
  } catch (e) {
    prodBlocked = e.message.includes('produção');
  }
  assert(prodBlocked, 'produção exige PAYMENT_CARD_ALLOW_PRODUCTION');
  process.env.NODE_ENV = savedEnv;
  process.env.PAYMENT_CARD_ALLOW_PRODUCTION = savedAllow;

  console.log('\n— checkout cartão: aprovado —');
  const userApproved = await createTestUser('approved');
  const chkApproved = await checkoutCard(userApproved, CARD_SANDBOX_TOKENS.approved);
  assert(chkApproved.ok, 'checkout aprovado ok');
  assert(chkApproved.payment_status === 'approved', 'status approved');
  assert(chkApproved.activated === true, 'assinatura ativada');
  const subApproved = await assinaturaStatus(userApproved);
  assert(subApproved?.status === 'ativa', 'assinatura ativa no banco');
  assert((await faturaStatus(chkApproved.fatura_id)) === 'paga', 'fatura paga');

  console.log('\n— checkout cartão: recusado —');
  const userRejected = await createTestUser('rejected');
  const chkRejected = await checkoutCard(userRejected, CARD_SANDBOX_TOKENS.rejected);
  assert(chkRejected.ok, 'checkout recusado retorna ok (registro)');
  assert(chkRejected.payment_status === 'rejected', 'status rejected');
  assert(chkRejected.activated === false, 'não ativa assinatura');
  assert((await faturaStatus(chkRejected.fatura_id)) === 'cancelada', 'fatura cancelada');

  console.log('\n— checkout cartão: parcelado —');
  const userInst = await createTestUser('installments');
  const chkInst = await checkoutCard(userInst, CARD_SANDBOX_TOKENS.installments, 3);
  assert(chkInst.ok, 'checkout parcelado ok');
  assert(chkInst.payment_status === 'approved', 'parcelado aprovado');
  assert(chkInst.installments === 3, '3 parcelas no retorno');
  assert(chkInst.activated === true, 'parcelado ativa plano');

  const payPayload = await query(
    `SELECT payload FROM pagamentos WHERE fatura_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [chkInst.fatura_id]
  );
  const payload =
    typeof payPayload.rows[0]?.payload === 'string'
      ? JSON.parse(payPayload.rows[0].payload)
      : payPayload.rows[0]?.payload;
  assert(payload?.installments === 3, 'payload grava 3 parcelas');

  console.log('\n— checkout cartão: cancelado —');
  const userCancelled = await createTestUser('cancelled');
  const chkCancelled = await checkoutCard(userCancelled, CARD_SANDBOX_TOKENS.cancelled);
  assert(chkCancelled.ok, 'checkout cancelado retorna ok');
  assert(chkCancelled.payment_status === 'cancelled', 'status cancelled');
  assert(chkCancelled.activated === false, 'cancelado não ativa');
  assert((await faturaStatus(chkCancelled.fatura_id)) === 'cancelada', 'fatura cancelada');

  console.log('\n— createCardPayment mock direto —');
  const direct = await createCardPayment({
    valueReais: 29.9,
    description: 'Teste',
    externalReference: 'fluxiva:fatura:00000000-0000-4000-8000-000000000001',
    cardToken: CARD_SANDBOX_TOKENS.approved,
  });
  assert(direct.sandbox === true, 'pagamento mock sandbox');
  assert(direct.status === 'approved', 'mock direto aprovado');

  console.log('\n=== Todos os testes 7.8A (cartão MP) passaram ===\n');
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
