/**
 * Testes Etapa 7.4 — Cobrança real Asaas (mock), PIX, webhook, upgrade/downgrade, admin
 * npm run test:74  (API em http://127.0.0.1:3001)
 */
import { config } from 'dotenv';
config();

import bcrypt from 'bcryptjs';
import { query, pool } from './db.js';
import { createInitialState } from './initialState.js';
import { runMigrations } from './migrate.js';
import { ensureAssinaturaPadrao } from './billing/subscriptions.js';
import { paymentExternalRef } from './billing/gateways/asaas.js';
import { BILLING_RULES_DOC } from './billing/billingRules.js';
import {
  emailCobrancaCriada,
  emailPagamentoConfirmado,
  emailAssinaturaAtrasada,
  emailAssinaturaCancelada,
} from './billing/billingEmails.js';
import { runBillingHealthChecks } from './billing/billingHealthLib.js';

process.env.BILLING_USE_MOCK_GATEWAY = 'true';
delete process.env.ASAAS_API_KEY;

const BASE = `http://127.0.0.1:${process.env.PORT || 3001}/api`;
const TS = Date.now();

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
      ...(opts.webhookToken ? { 'asaas-access-token': opts.webhookToken } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !opts.allowError) {
    throw new Error(`${path} → ${res.status}: ${data.error || res.statusText}`);
  }
  return { status: res.status, data };
}

async function createUser({ email, senha, tipo }) {
  const hash = await bcrypt.hash(senha, 12);
  const ins = await query(
    `INSERT INTO usuarios (email, senha_hash, nome, role, ativo, tipo_perfil, nome_perfil, email_verificado)
     VALUES ($1,$2,'T74 User','user',true,$3,'Empresa 74',true) RETURNING id`,
    [email, hash, tipo]
  );
  await query('INSERT INTO estados (usuario_id, dados) VALUES ($1,$2)', [
    ins.rows[0].id,
    JSON.stringify(createInitialState(tipo, 'Empresa 74')),
  ]);
  await ensureAssinaturaPadrao(ins.rows[0].id);
  return ins.rows[0];
}

async function login(email, senha) {
  const { data } = await req('/auth/login', { method: 'POST', body: { email, senha } });
  return data.token;
}

async function cleanup(emails) {
  for (const email of emails) {
    const { rows } = await query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (!rows.length) continue;
    const id = rows[0].id;
    await query('DELETE FROM admin_saas_auditoria WHERE alvo_usuario_id = $1 OR admin_usuario_id = $1', [id]).catch(() => {});
    await query('DELETE FROM eventos_pagamento WHERE payload::text LIKE $1', [`%${id}%`]).catch(() => {});
    await query('DELETE FROM pagamentos WHERE usuario_id = $1', [id]).catch(() => {});
    await query('DELETE FROM faturas WHERE usuario_id = $1', [id]).catch(() => {});
    await query('DELETE FROM assinaturas WHERE usuario_id = $1', [id]).catch(() => {});
    await query('DELETE FROM estados WHERE usuario_id = $1', [id]);
    await query('DELETE FROM usuarios WHERE id = $1', [id]);
  }
}

async function waitForApi(maxMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const r = await fetch(`${BASE}/status`);
      if (r.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('API não respondeu a tempo. Rode: npm run server');
}

async function main() {
  console.log('=== Testes Etapa 7.4 ===\n');
  await runMigrations();

  console.log('— billing:health (mock) —');
  const health = await runBillingHealthChecks({ createTestCharge: false });
  assert(health.mock === true, 'health detecta mock');
  assert(health.apiKeyPresent === false, 'health sem API key em teste');
  assert(health.webhookUrl.includes('/api/billing/webhook/asaas'), 'health URL webhook');

  console.log('\n— regras upgrade/downgrade documentadas —');
  assert(BILLING_RULES_DOC.upgrade.includes('PIX'), 'regra upgrade PIX');
  assert(BILLING_RULES_DOC.downgrade.includes('reembolso'), 'regra downgrade sem reembolso');

  console.log('\n— e-mails não quebram sem SMTP —');
  const fakeId = '00000000-0000-0000-0000-000000000099';
  const r1 = await emailCobrancaCriada(fakeId, { planoNome: 'Test', valorCentavos: 100, vencimento: new Date() });
  const r2 = await emailPagamentoConfirmado(fakeId, { planoNome: 'Test' });
  const r3 = await emailAssinaturaAtrasada(fakeId);
  const r4 = await emailAssinaturaCancelada(fakeId, { acessoAte: new Date() });
  assert(r1.sent === false || r1.sent === true, 'email cobrança não lança');
  assert(r2.sent === false || r2.sent === true, 'email confirmado não lança');
  assert(r3.sent === false || r3.sent === true, 'email atrasada não lança');
  assert(r4.sent === false || r4.sent === true, 'email cancelada não lança');

  const pfEmail = `pf_74_${TS}@test.local`;
  const adminEmail = `admin_74_${TS}@test.local`;
  const pass = 'senha123';
  await cleanup([pfEmail, adminEmail]);

  const user = await createUser({ email: pfEmail, senha: pass, tipo: 'fisica' });
  const adminHash = await bcrypt.hash(pass, 12);
  await query(
    `INSERT INTO usuarios (email, senha_hash, nome, role, ativo, tipo_perfil, nome_perfil, email_verificado)
     VALUES ($1,$2,'Admin 74','admin',true,'juridica','Admin',true)`,
    [adminEmail, adminHash]
  );

  const token = await login(pfEmail, pass);
  const adminToken = await login(adminEmail, pass);

  const { data: sub0 } = await req('/billing/assinatura', { token });
  assert(sub0.assinatura.status === 'trial', 'inicia trial');
  const { rows: planoBefore } = await query(
    `SELECT a.plano_id, p.slug FROM assinaturas a JOIN planos p ON p.id = a.plano_id WHERE a.usuario_id = $1`,
    [user.id]
  );
  const planoIdAntes = planoBefore[0].plano_id;

  console.log('\n— checkout PIX (mock) —');
  const { data: checkout } = await req('/billing/checkout', {
    token,
    method: 'POST',
    body: { plano_slug: 'pf_plus' },
  });
  assert(checkout.ok, 'checkout ok');
  assert(checkout.pix?.copy_paste || checkout.pix?.invoice_url, 'PIX ou link');
  assert(checkout.plano_slug === 'pf_plus', 'checkout referencia plano alvo');
  const { rows: planoAfterCheckout } = await query(
    `SELECT a.plano_id, p.slug FROM assinaturas a JOIN planos p ON p.id = a.plano_id WHERE a.usuario_id = $1`,
    [user.id]
  );
  assert(planoAfterCheckout[0].plano_id === planoIdAntes, 'plano_id não muda antes do pagamento');

  console.log('\n— webhook confirmado + duplicado —');
  const extRef = paymentExternalRef(checkout.fatura_id);
  const webhookBody = {
    event: 'PAYMENT_CONFIRMED',
    dateCreated: new Date().toISOString(),
    payment: {
      id: checkout.gateway_payment_id,
      externalReference: extRef,
      status: 'CONFIRMED',
    },
  };
  const wh1 = await req('/billing/webhook/asaas', { method: 'POST', body: webhookBody });
  assert(wh1.data.ok && wh1.data.activated, 'webhook ativa assinatura');
  const wh2 = await req('/billing/webhook/asaas', { method: 'POST', body: webhookBody });
  assert(wh2.data.duplicate === true, 'webhook duplicado idempotente');

  const { data: subAtiva } = await req('/billing/assinatura', { token });
  assert(subAtiva.assinatura.status === 'ativa', 'assinatura ativa');
  assert(subAtiva.assinatura.plano.slug === 'pf_plus', 'plano pf_plus após pagamento');
  assert(subAtiva.assinatura.proxima_cobranca, 'proxima_cobranca definida');

  console.log('\n— PAYMENT_OVERDUE → atrasada —');
  await query(
    `UPDATE assinaturas SET status = 'ativa' WHERE usuario_id = $1`,
    [user.id]
  );
  const overdueBody = {
    event: 'PAYMENT_OVERDUE',
    payment: {
      id: checkout.gateway_payment_id,
      externalReference: extRef,
    },
  };
  const whOver = await req('/billing/webhook/asaas', {
    method: 'POST',
    body: { ...overdueBody, dateCreated: new Date().toISOString() },
  });
  assert(whOver.data.overdue === true, 'webhook overdue processado');
  assert(whOver.data.fatura_id, 'overdue identifica fatura');
  const { rows: stOver } = await query('SELECT status FROM assinaturas WHERE usuario_id = $1', [
    user.id,
  ]);
  assert(stOver[0].status === 'atrasada', 'overdue marca atrasada');

  console.log('\n— upgrade gera cobrança —');
  const { data: up } = await req('/billing/trocar-plano', {
    token,
    method: 'POST',
    body: { plano_slug: 'pf_premium' },
  });
  assert(up.tipo === 'upgrade', 'upgrade tipo');
  assert(up.fatura_id, 'upgrade gera fatura');

  console.log('\n— downgrade imediato —');
  await query(
    `UPDATE assinaturas SET status = 'ativa', plano_id = (SELECT id FROM planos WHERE slug = 'pf_premium') WHERE usuario_id = $1`,
    [user.id]
  );
  const { data: down } = await req('/billing/trocar-plano', {
    token,
    method: 'POST',
    body: { plano_slug: 'pf_plus' },
  });
  assert(down.tipo === 'downgrade', 'downgrade tipo');
  assert(down.regra === BILLING_RULES_DOC.downgrade, 'downgrade regra documentada');

  console.log('\n— cancelamento mantém acesso —');
  const { data: cancel } = await req('/billing/cancelar', { token, method: 'POST', body: {} });
  assert(cancel.ok, 'cancel ok');
  assert(cancel.message?.includes('ficará ativa até'), 'mensagem acesso até');
  assert(cancel.assinatura.acesso_ate, 'acesso_ate definido');

  console.log('\n— admin: reenviar, marcar pago, webhooks —');
  await query(
    `UPDATE assinaturas SET status = 'trial', cancelada_em = NULL, acesso_ate = NULL WHERE usuario_id = $1`,
    [user.id]
  );
  const { data: chk2 } = await req('/billing/checkout', {
    token,
    method: 'POST',
    body: { plano_slug: 'pf_plus' },
  });
  const { data: reenv } = await req(`/admin/clientes/${user.id}/reenviar-cobranca`, {
    token: adminToken,
    method: 'POST',
    body: {},
  });
  assert(reenv.ok, 'admin reenviar cobrança');

  const { data: pago } = await req(`/admin/clientes/${user.id}/marcar-pago`, {
    token: adminToken,
    method: 'POST',
    body: { fatura_id: chk2.fatura_id },
  });
  assert(pago.ok, 'admin marcar pago');
  const { data: subAdmin } = await req('/billing/assinatura', { token });
  assert(subAdmin.assinatura.status === 'ativa', 'marcar pago ativa');

  const { data: whList } = await req(`/admin/clientes/${user.id}/webhooks`, { token: adminToken });
  assert(Array.isArray(whList.eventos), 'lista webhooks admin');

  console.log('\n— PAYMENT_REFUNDED não apaga dados —');
  const refundBody = {
    event: 'PAYMENT_REFUNDED',
    payment: { id: chk2.gateway_payment_id, externalReference: paymentExternalRef(chk2.fatura_id) },
  };
  await req('/billing/webhook/asaas', { method: 'POST', body: refundBody });
  const { rows: fatRows } = await query('SELECT id FROM faturas WHERE usuario_id = $1', [user.id]);
  assert(fatRows.length >= 1, 'faturas preservadas após estorno');

  await cleanup([pfEmail, adminEmail]);
  console.log('\n=== Todos os testes 7.4 passaram ===\n');
  await pool.end();
}

const isMain = process.argv[1]?.includes('test74');
if (isMain) {
  waitForApi()
    .then(main)
    .catch((err) => {
      console.error(err);
      pool.end().finally(() => process.exit(1));
    });
}
