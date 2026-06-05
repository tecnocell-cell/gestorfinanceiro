/**
 * Testes Etapa 7.9 — PIX Mercado Pago (mock + sandbox opcional)
 * npm run test:mp-pix
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
import { createCheckout, processMercadoPagoWebhook } from './billing/billingService.js';
import { ensureAssinaturaPadrao } from './billing/subscriptions.js';
import {
  mockPixPaymentIdFromScenario,
  registerMockPixPayment,
  getMockPixPaymentById,
  setMockPixScenario,
} from './billing/pixSandbox.js';
import { expectedMpWebhookUrl } from './billing/billingUrls.js';
import {
  createPixPayment,
  getPayment,
  parsePaymentExternalRef,
} from './billing/gateways/mercadoPago.js';
import { BILLING_OPS_TYPES } from './billing/billingOpsLog.js';

process.env.BILLING_USE_MOCK_GATEWAY = 'true';

const TS = Date.now();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function createTestUser(suffix) {
  const email = `pix_mp_${suffix}_${TS}@fluxiva.test`;
  const hash = await bcrypt.hash('TestPix!79', 10);
  const { rows } = await query(
    `INSERT INTO usuarios (email, nome, senha_hash, role, tipo_perfil, nome_perfil, ativo)
     VALUES ($1, $2, $3, 'user', 'fisica', 'PF', true) RETURNING id`,
    [email, `Pix ${suffix}`, hash]
  );
  const userId = rows[0].id;
  await ensureAssinaturaPadrao(userId);
  return userId;
}

async function faturaStatus(faturaId) {
  const { rows } = await query(`SELECT status, pago_em FROM faturas WHERE id = $1`, [faturaId]);
  return rows[0];
}

async function assinaturaRow(userId) {
  const { rows } = await query(
    `SELECT a.status, a.trial_ate, a.proxima_cobranca, p.slug
     FROM assinaturas a
     JOIN planos p ON p.id = a.plano_id
     WHERE a.usuario_id = $1`,
    [userId]
  );
  return rows[0];
}

async function pagamentoStatus(gatewayPaymentId) {
  const { rows } = await query(
    `SELECT status FROM pagamentos WHERE gateway_payment_id = $1`,
    [gatewayPaymentId]
  );
  return rows[0]?.status;
}

async function simulateWebhook(paymentId, action = 'payment.updated') {
  const body = { action, data: { id: paymentId }, type: 'payment' };
  return processMercadoPagoWebhook(body, { topic: 'payment', id: paymentId });
}

async function main() {
  console.log('=== Testes Etapa 7.9 — PIX Mercado Pago ===\n');
  await runMigrations();

  console.log('— arquivos —');
  const files = [
    'server/billing/pixSandbox.js',
    'server/billing/billingUrls.js',
    'server/billing/gateways/mercadoPago.js',
    'server/testMpPix.js',
  ];
  for (const f of files) assert(existsSync(join(ROOT, f)), `${f} existe`);

  const pkg = readFileSync(join(ROOT, 'package.json'), 'utf8');
  assert(pkg.includes('"test:mp-pix"'), 'script test:mp-pix');

  const opsLog = readFileSync(join(ROOT, 'server/billing/billingOpsLog.js'), 'utf8');
  assert(opsLog.includes('PIX_GERADO'), 'log PIX_GERADO');

  console.log('\n— webhook URL —');
  const savedPublic = process.env.PUBLIC_API_URL;
  delete process.env.PUBLIC_API_URL;
  const defaultUrl = expectedMpWebhookUrl();
  assert(
    defaultUrl === 'https://financeiro.fluxiva.app/api/billing/webhook/mercado-pago',
    'URL padrão produção sem localhost'
  );
  process.env.PUBLIC_API_URL = 'https://financeiro.fluxiva.app';
  assert(
    expectedMpWebhookUrl() === 'https://financeiro.fluxiva.app/api/billing/webhook/mercado-pago',
    'URL com PUBLIC_API_URL'
  );
  if (savedPublic) process.env.PUBLIC_API_URL = savedPublic;
  else delete process.env.PUBLIC_API_URL;

  console.log('\n— pixSandbox mock —');
  const mockId = mockPixPaymentIdFromScenario('pending');
  registerMockPixPayment({
    id: mockId,
    status: 'pending',
    external_reference: 'fluxiva:fatura:00000000-0000-4000-8000-000000000099',
    transaction_amount: 29.9,
  });
  const mockPay = getMockPixPaymentById(mockId);
  assert(mockPay.status === 'pending', 'mock PIX pending');
  assert(mockPay.external_reference?.includes('fluxiva:fatura:'), 'external_reference no mock');
  setMockPixScenario(mockId, 'approved');
  assert(getMockPixPaymentById(mockId).status === 'approved', 'setMockPixScenario approved');

  await patchPaymentConfig('mercado_pago', {
    config: { access_token: 'TEST_MP_PIX', public_key: 'TEST_PUBLIC_PIX' },
    active: true,
  });
  await activateProvider('mercado_pago');

  console.log('\n— criar PIX mock (checkout) —');
  const userPending = await createTestUser('pending');
  const checkout = await createCheckout(userPending, 'pf_basico', {
    metodo: 'pix',
    gateway: 'mercado_pago',
  });
  assert(checkout.ok, 'checkout PIX ok');
  assert(checkout.pix?.copy_paste || checkout.pix?.copiaECola, 'copia e cola');
  assert(checkout.gateway === 'mercado_pago', 'gateway mercado_pago');
  const payId = checkout.gateway_payment_id;
  const payConsult = await getPayment(payId);
  assert(payConsult.status === 'pending', 'consulta pagamento pending');
  assert(
    parsePaymentExternalRef(payConsult.external_reference) === checkout.fatura_id,
    'external_reference aponta fatura'
  );

  console.log('\n— webhook pending —');
  const wPending = await simulateWebhook(payId);
  assert(wPending.ok && wPending.pending, 'webhook pending não ativa');
  assert((await pagamentoStatus(payId)) === 'pendente', 'pagamento permanece pendente');
  const subPending = await assinaturaRow(userPending);
  assert(subPending?.status === 'trial', 'trial mantido em pending');

  console.log('\n— webhook approved —');
  setMockPixScenario(payId, 'approved');
  const wApproved = await simulateWebhook(payId, 'payment.approved');
  assert(wApproved.ok && wApproved.activated, 'webhook approved ativa');
  const fatApproved = await faturaStatus(checkout.fatura_id);
  assert(fatApproved?.status === 'paga', 'fatura paga');
  assert(fatApproved?.pago_em, 'data de pagamento gravada');
  assert((await pagamentoStatus(payId)) === 'confirmado', 'pagamento confirmado');
  const subApproved = await assinaturaRow(userPending);
  assert(subApproved?.status === 'ativa', 'assinatura ativa');
  assert(!subApproved?.trial_ate || subApproved.status === 'ativa', 'trial encerrado');
  assert(subApproved?.proxima_cobranca, 'próxima cobrança definida');

  console.log('\n— webhook duplicado —');
  const wDup = await simulateWebhook(payId, 'payment.approved');
  assert(wDup.duplicate, 'webhook duplicado idempotente');
  const { rows: fatCount } = await query(
    `SELECT COUNT(*)::int AS n FROM faturas WHERE usuario_id = $1 AND status = 'paga'`,
    [userPending]
  );
  assert(fatCount[0].n === 1, 'não duplica fatura paga');

  console.log('\n— webhook rejected —');
  const userRejected = await createTestUser('rejected');
  const chkRejected = await createCheckout(userRejected, 'pf_basico', {
    metodo: 'pix',
    gateway: 'mercado_pago',
  });
  const rejId = chkRejected.gateway_payment_id;
  setMockPixScenario(rejId, 'rejected');
  const wRejected = await simulateWebhook(rejId, 'payment.rejected');
  assert(wRejected.ok && wRejected.rejected, 'webhook rejected');
  assert((await faturaStatus(chkRejected.fatura_id))?.status === 'cancelada', 'fatura cancelada');
  assert((await pagamentoStatus(rejId)) === 'cancelado', 'pagamento cancelado');

  console.log('\n— webhook cancelled —');
  const userCancelled = await createTestUser('cancelled');
  const chkCancelled = await createCheckout(userCancelled, 'pf_basico', {
    metodo: 'pix',
    gateway: 'mercado_pago',
  });
  const canId = chkCancelled.gateway_payment_id;
  setMockPixScenario(canId, 'cancelled');
  const wCancelled = await simulateWebhook(canId, 'payment.cancelled');
  assert(wCancelled.ok && wCancelled.cancelled, 'webhook cancelled');
  assert((await faturaStatus(chkCancelled.fatura_id))?.status === 'cancelada', 'fatura cancelada');

  console.log('\n— createPixPayment mock direto —');
  const direct = await createPixPayment({
    valueReais: 39.9,
    description: 'Teste PIX',
    externalReference: 'fluxiva:fatura:00000000-0000-4000-8000-000000000002',
    dueDate: '2026-06-10',
  });
  assert(direct.status === 'pending' && direct.mock, 'PIX mock direto pending');
  assert(direct.copiaECola?.includes('MPMOCKPIX'), 'copia e cola mock');

  console.log('\n— logs operacionais —');
  assert(BILLING_OPS_TYPES.PIX_GERADO === 'pix_gerado', 'tipo PIX_GERADO');

  const tokenTest =
    process.env.ACCESS_TOKEN_TEST || process.env.MP_ACCESS_TOKEN_TEST || process.env.MP_ACCESS_TOKEN;
  if (tokenTest && process.env.MP_PIX_SANDBOX_LIVE === 'true') {
    console.log('\n— sandbox real (ACCESS_TOKEN_TEST) —');
    const prevMock = process.env.BILLING_USE_MOCK_GATEWAY;
    process.env.BILLING_USE_MOCK_GATEWAY = 'false';
    await patchPaymentConfig('mercado_pago', {
      config: { access_token: tokenTest, public_key: process.env.MP_PUBLIC_KEY || 'TEST' },
      active: true,
    });
    try {
      const live = await createPixPayment({
        valueReais: 0.01,
        description: 'Homologação Fluxiva PIX',
        externalReference: `fluxiva:test:${TS}`,
        payerEmail: `sandbox_pix_${TS}@fluxiva.test`,
      });
      assert(live.id && !live.mock, 'PIX sandbox real criado');
      const liveGet = await getPayment(live.id);
      assert(liveGet.status, 'consulta sandbox ok');
      console.log(`  ✓ pagamento sandbox ${live.id} (${liveGet.status})`);
    } catch (e) {
      console.log(`  ⚠ sandbox real ignorado: ${e.message}`);
    } finally {
      process.env.BILLING_USE_MOCK_GATEWAY = prevMock;
      process.env.BILLING_USE_MOCK_GATEWAY = 'true';
    }
  } else {
    console.log('\n— sandbox real —');
    console.log('  (pulado — defina ACCESS_TOKEN_TEST e MP_PIX_SANDBOX_LIVE=true para testar API real)');
  }

  console.log('\n=== Todos os testes 7.9 (PIX MP) passaram ===\n');
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
