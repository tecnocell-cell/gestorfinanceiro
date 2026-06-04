/**
 * Homologação Asaas sandbox — Etapa 7.5
 * npm run test:asaas:sandbox
 * Requer: ASAAS_API_KEY + ASAAS_ENV=sandbox
 * API local em execução para webhook simulado (opcional: sobe sozinho se PORT livre).
 */
import { config } from 'dotenv';
config();

import bcrypt from 'bcryptjs';
import { query, pool } from './db.js';
import { createInitialState } from './initialState.js';
import { runMigrations } from './migrate.js';
import { ensureAssinaturaPadrao } from './billing/subscriptions.js';
import {
  getAsaasEnv,
  isAsaasRealKeyConfigured,
  createOrGetCustomer,
  createPixPayment,
  getPayment,
  cancelPayment,
  paymentExternalRef,
} from './billing/gateways/asaas.js';
import { processAsaasWebhook } from './billing/billingService.js';
import { BILLING_OPS_TYPES } from './billing/billingOpsLog.js';

process.env.BILLING_USE_MOCK_GATEWAY = 'false';

const BASE = `http://127.0.0.1:${process.env.PORT || 3001}/api`;
const TS = Date.now();

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !opts.allowError) throw new Error(`${path} → ${res.status}: ${data.error || res.statusText}`);
  return { status: res.status, data };
}

async function waitApi() {
  for (let i = 0; i < 25; i++) {
    try {
      const r = await fetch(`${BASE}/status`);
      if (r.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('API offline — rode npm run server');
}

async function cleanup(email) {
  const { rows } = await query('SELECT id FROM usuarios WHERE email = $1', [email]);
  if (!rows.length) return;
  const id = rows[0].id;
  await query('DELETE FROM billing_ops_log WHERE usuario_id = $1', [id]).catch(() => {});
  await query('DELETE FROM eventos_pagamento WHERE payload::text LIKE $1', [`%${id}%`]).catch(() => {});
  await query('DELETE FROM pagamentos WHERE usuario_id = $1', [id]).catch(() => {});
  await query('DELETE FROM faturas WHERE usuario_id = $1', [id]).catch(() => {});
  await query('DELETE FROM assinaturas WHERE usuario_id = $1', [id]).catch(() => {});
  await query('DELETE FROM estados WHERE usuario_id = $1', [id]);
  await query('DELETE FROM usuarios WHERE id = $1', [id]);
}

async function main() {
  console.log('=== test:asaas:sandbox (Etapa 7.5) ===\n');
  console.log('Guia: docs/GUIA_ASAAS_SANDBOX.md\n');

  if (!isAsaasRealKeyConfigured()) {
    console.log('SKIP: configure ASAAS_API_KEY e ASAAS_ENV=sandbox');
    process.exit(0);
  }
  assert(getAsaasEnv() === 'sandbox', 'ambiente sandbox');

  await runMigrations();
  await waitApi();

  const email = `asaas_sb_${TS}@test.local`;
  const pass = 'senha123';
  await cleanup(email);

  const hash = await bcrypt.hash(pass, 12);
  const ins = await query(
    `INSERT INTO usuarios (email, senha_hash, nome, role, ativo, tipo_perfil, nome_perfil, email_verificado)
     VALUES ($1,$2,'Sandbox PF','user',true,'fisica','PF SB',true) RETURNING id`,
    [email, hash]
  );
  const userId = ins.rows[0].id;
  await query('INSERT INTO estados (usuario_id, dados) VALUES ($1,$2)', [
    userId,
    JSON.stringify(createInitialState('fisica', 'PF SB')),
  ]);
  await ensureAssinaturaPadrao(userId);

  console.log('\n— API Asaas direta —');
  const customer = await createOrGetCustomer({
    name: 'Sandbox Fluxiva',
    email,
    externalReference: `fluxiva:sb:${userId}`,
  });
  assert(customer.id, 'cliente Asaas');

  const due = new Date();
  due.setDate(due.getDate() + 3);
  const pay = await createPixPayment({
    customerId: customer.id,
    valueReais: 29.9,
    dueDate: due.toISOString().slice(0, 10),
    description: 'Homologação sandbox 7.5',
    externalReference: `fluxiva:sbpay:${TS}`,
  });
  assert(pay.id, 'cobrança PIX sandbox');
  assert(pay.payload || pay.encodedImage || pay.invoiceUrl, 'PIX ou link');

  const fetched = await getPayment(pay.id);
  assert(fetched.id === pay.id, 'consultar cobrança');

  console.log('\n— Checkout via API + webhook simulado —');
  const login = await req('/auth/login', { method: 'POST', body: { email, senha: pass } });
  const token = login.data.token;

  const checkout = await req('/billing/checkout', {
    token,
    method: 'POST',
    body: { plano_slug: 'pf_plus' },
  });
  assert(checkout.data.ok, 'checkout API');
  const faturaId = checkout.data.fatura_id;
  const payId = checkout.data.gateway_payment_id;

  const wh = await processAsaasWebhook({
    event: 'PAYMENT_CONFIRMED',
    dateCreated: new Date().toISOString(),
    payment: {
      id: payId,
      externalReference: paymentExternalRef(faturaId),
      status: 'CONFIRMED',
    },
  });
  assert(wh.ok && wh.activated, 'webhook simulado ativa assinatura');

  const sub = await req('/billing/assinatura', { token });
  assert(sub.data.assinatura.status === 'ativa', 'assinatura ativa após pagamento');
  assert(sub.data.assinatura.plano.slug === 'pf_plus', 'plano aplicado');

  const { rows: ops } = await query(
    `SELECT tipo FROM billing_ops_log WHERE usuario_id = $1 ORDER BY created_at`,
    [userId]
  );
  const tipos = ops.map((r) => r.tipo);
  assert(tipos.includes(BILLING_OPS_TYPES.CHECKOUT_CRIADO), 'log checkout');
  assert(tipos.includes(BILLING_OPS_TYPES.WEBHOOK_RECEBIDO), 'log webhook');
  assert(tipos.includes(BILLING_OPS_TYPES.ASSINATURA_ATIVADA), 'log assinatura ativada');

  console.log('\n— Cancelar cobrança teste isolada —');
  const cancelled = await cancelPayment(pay.id);
  assert(cancelled.deleted || cancelled.status, 'cancelar cobrança sandbox');

  await cleanup(email);
  console.log('\n✅ test:asaas:sandbox OK\n');
  await pool.end();
}

main().catch((e) => {
  console.error('\n❌ test:asaas:sandbox', e.message);
  pool.end().finally(() => process.exit(1));
});
