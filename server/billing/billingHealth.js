/**
 * Diagnóstico Asaas — npm run billing:health
 * Opcional: npm run billing:health -- --create-test-charge
 */
import { config } from 'dotenv';
config();

import { getAsaasEnv, createOrGetCustomer, createPixPayment } from './gateways/asaas.js';
import { pingAsaas, runBillingHealthChecks } from './billingHealthLib.js';

const createTest = process.argv.includes('--create-test-charge');

async function main() {
  console.log('=== billing:health ===\n');

  const health = await runBillingHealthChecks({ createTestCharge: createTest });

  console.log(`API key: ${health.apiKeyPresent ? 'presente' : 'ausente'}`);
  console.log(`Ambiente: ${health.env}`);
  console.log(`Mock gateway: ${health.mock ? 'sim' : 'não'}`);
  console.log(
    `Webhook token: ${health.webhookTokenConfigured ? 'configurado' : 'ausente (aceita qualquer em dev)'}`
  );
  console.log(`Webhook URL esperada: ${health.webhookUrl}`);

  if (!health.realConfigured) {
    console.log('\n⚠ Cobrança real desativada (mock ou sem chave).');
    process.exit(0);
  }

  const ping = await pingAsaas();
  console.log(`Conexão API: ${ping.ok ? 'OK' : `FALHA — ${ping.error}`}`);
  if (!ping.ok) process.exit(1);

  const env = getAsaasEnv();
  if (createTest && env === 'sandbox') {
    const due = new Date();
    due.setDate(due.getDate() + 2);
    const customer = await createOrGetCustomer({
      name: 'Health Check Fluxiva',
      email: `health_${Date.now()}@test.local`,
      externalReference: `fluxiva:health:${Date.now()}`,
    });
    const pay = await createPixPayment({
      customerId: customer.id,
      valueReais: 1.99,
      dueDate: due.toISOString().slice(0, 10),
      description: 'Health check sandbox',
      externalReference: `fluxiva:healthpay:${Date.now()}`,
    });
    console.log(`Cobrança teste: ${pay.id} (PIX: ${pay.payload ? 'sim' : 'link'})`);
  } else if (createTest) {
    console.log('Cobrança teste ignorada fora de sandbox.');
  }

  console.log('\n✅ billing:health OK\n');
}

main().catch((e) => {
  console.error('❌ billing:health', e.message);
  process.exit(1);
});
