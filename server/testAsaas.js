/**
 * Teste integração Asaas sandbox — Etapa 7.2
 * npm run test:asaas
 * Requer: ASAAS_API_KEY + ASAAS_ENV=sandbox (nunca produção sem flag explícita)
 */
import { config } from 'dotenv';
config();

import {
  getAsaasEnv,
  isAsaasRealKeyConfigured,
  createOrGetCustomer,
  createPixPayment,
  getPayment,
  cancelPayment,
} from './billing/gateways/asaas.js';

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function main() {
  console.log('=== Teste Asaas (sandbox) ===\n');

  if (!isAsaasRealKeyConfigured()) {
    console.log('SKIP: ASAAS_API_KEY ausente ou mock ativo. Configure sandbox para testar.');
    process.exit(0);
  }

  const env = getAsaasEnv();
  assert(env === 'sandbox', `ambiente sandbox (got ${env})`);
  if (env === 'production') {
    throw new Error('test:asaas bloqueado em production');
  }

  const ext = `fluxiva:test:${Date.now()}`;
  const customer = await createOrGetCustomer({
    name: 'Teste Fluxiva Sandbox',
    email: `test_asaas_${Date.now()}@test.local`,
    externalReference: ext,
  });
  assert(customer.id, 'cliente criado');

  const due = new Date();
  due.setDate(due.getDate() + 3);
  const dueStr = due.toISOString().slice(0, 10);

  const payment = await createPixPayment({
    customerId: customer.id,
    valueReais: 1.99,
    dueDate: dueStr,
    description: 'Teste sandbox Fluxiva',
    externalReference: `fluxiva:testpay:${Date.now()}`,
  });
  assert(payment.id, 'cobrança PIX criada');
  assert(payment.payload || payment.encodedImage, 'dados PIX retornados');

  const fetched = await getPayment(payment.id);
  assert(fetched.id === payment.id, 'consulta cobrança');

  const cancelled = await cancelPayment(payment.id);
  assert(cancelled.deleted || cancelled.status, 'cancelamento cobrança');

  console.log('\n✅ test:asaas OK (sandbox)\n');
}

main().catch((e) => {
  console.error('\n❌ test:asaas', e.message);
  process.exit(1);
});
