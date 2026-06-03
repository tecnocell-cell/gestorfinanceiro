/**
 * Testes Etapa 6.5 — Cobrança Asaas (mock), faturas e assinaturas
 * Uso: npm run test:65  (servidor: npm run server)
 */
import { config } from 'dotenv';
config();

import bcrypt from 'bcryptjs';
import { query, pool } from './db.js';
import { createInitialState } from './initialState.js';
import { runMigrations } from './migrate.js';
import { paymentExternalRef } from './billing/gateways/asaas.js';
import { refreshSubscriptionLifecycle } from './billing/subscriptionLifecycle.js';

process.env.BILLING_USE_MOCK_GATEWAY = 'true';
delete process.env.ASAAS_API_KEY;

const BASE = `http://127.0.0.1:${process.env.PORT || 3001}/api`;
const TS = Date.now();

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

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function createUser({ email, senha, tipo, nomePerfil }) {
  const hash = await bcrypt.hash(senha, 12);
  const ins = await query(
    `INSERT INTO usuarios (
       email, senha_hash, nome, role, ativo, tipo_perfil, nome_perfil, email_verificado
     ) VALUES ($1,$2,$3,'user',true,$4,$5,true) RETURNING id`,
    [email, hash, nomePerfil, tipo, nomePerfil]
  );
  const st = createInitialState(tipo, nomePerfil);
  await query('INSERT INTO estados (usuario_id, dados) VALUES ($1,$2)', [
    ins.rows[0].id,
    JSON.stringify(st),
  ]);
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
    await query('DELETE FROM eventos_pagamento WHERE payload::text LIKE $1', [`%${id}%`]).catch(
      () => {}
    );
    await query(
      `DELETE FROM eventos_pagamento WHERE idempotency_key LIKE 'PAYMENT_%'`
    ).catch(() => {});
    await query('DELETE FROM pagamentos WHERE usuario_id = $1', [id]);
    await query('DELETE FROM faturas WHERE usuario_id = $1', [id]);
    await query('DELETE FROM assinaturas WHERE usuario_id = $1', [id]);
    await query('DELETE FROM estados WHERE usuario_id = $1', [id]);
    await query('DELETE FROM usuarios WHERE id = $1', [id]);
  }
}

function daysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function main() {
  console.log('=== Testes Etapa 6.5 — Cobrança e assinaturas ===\n');
  await runMigrations();

  const emailPf = `test_65_pf_${TS}@test.local`;
  const emailPj = `test_65_pj_${TS}@test.local`;
  const pass = 'test123456';
  await cleanup([emailPf, emailPj]);

  const userPf = await createUser({
    email: emailPf,
    senha: pass,
    tipo: 'fisica',
    nomePerfil: 'Test PF 65',
  });
  const userPj = await createUser({
    email: emailPj,
    senha: pass,
    tipo: 'juridica',
    nomePerfil: 'Test PJ 65',
  });
  const tokenPf = await login(emailPf, pass);
  const tokenPj = await login(emailPj, pass);

  console.log('--- Trial PF 7d / PJ 14d ---');
  const { data: subPf } = await req('/billing/assinatura', { token: tokenPf });
  const { data: subPj } = await req('/billing/assinatura', { token: tokenPj });
  assert(subPf.assinatura.status === 'trial', 'PF inicia em trial');
  assert(subPj.assinatura.status === 'trial', 'PJ inicia em trial');

  const trialPf = new Date(subPf.assinatura.trial_ate);
  const trialPj = new Date(subPj.assinatura.trial_ate);
  const diffPf = Math.round((trialPf - new Date()) / 86400000);
  const diffPj = Math.round((trialPj - new Date()) / 86400000);
  assert(diffPf >= 6 && diffPf <= 8, `PF trial ~7 dias (got ${diffPf})`);
  assert(diffPj >= 13 && diffPj <= 15, `PJ trial ~14 dias (got ${diffPj})`);

  console.log('\n--- Checkout PIX (mock) ---');
  const { data: checkout } = await req('/billing/checkout', {
    token: tokenPf,
    method: 'POST',
    body: { plano_slug: 'pf_plus' },
  });
  assert(checkout.ok, 'checkout ok');
  assert(checkout.fatura_id, 'fatura criada');
  assert(checkout.gateway_payment_id, 'payment id mock');
  assert(checkout.pix?.copy_paste || checkout.pix?.encoded_image !== undefined, 'dados PIX');

  const { data: faturasList } = await req('/billing/faturas', { token: tokenPf });
  assert(faturasList.faturas?.length >= 1, 'lista faturas');
  assert(faturasList.faturas[0].status === 'pendente', 'fatura pendente');

  console.log('\n--- Webhook pagamento + idempotência ---');
  const extRef = paymentExternalRef(checkout.fatura_id);
  const webhookBody = {
    event: 'PAYMENT_RECEIVED',
    dateCreated: new Date().toISOString(),
    payment: {
      id: checkout.gateway_payment_id,
      externalReference: extRef,
      status: 'RECEIVED',
      value: 29.9,
    },
  };

  const wh1 = await req('/billing/webhook/asaas', {
    method: 'POST',
    body: webhookBody,
  });
  assert(wh1.data.ok && wh1.data.activated, 'webhook ativa assinatura');

  const { data: subAfter } = await req('/billing/assinatura', { token: tokenPf });
  assert(subAfter.assinatura.status === 'ativa', 'assinatura ativa após pagamento');
  assert(subAfter.assinatura.plano.slug === 'pf_plus', 'plano pf_plus');
  assert(subAfter.assinatura.proxima_cobranca, 'próxima cobrança definida');

  const wh2 = await req('/billing/webhook/asaas', {
    method: 'POST',
    body: webhookBody,
  });
  assert(wh2.data.duplicate === true, 'webhook duplicado ignorado');

  const { rows: evtCount } = await query(
    `SELECT COUNT(*)::int AS n FROM eventos_pagamento WHERE gateway = 'asaas' AND idempotency_key LIKE $1`,
    [`PAYMENT_RECEIVED:${checkout.gateway_payment_id}%`]
  );
  assert(evtCount[0].n === 1, 'apenas um evento persistido');

  console.log('\n--- Histórico pagamentos ---');
  const { data: pays } = await req('/billing/pagamentos', { token: tokenPf });
  assert(pays.pagamentos?.length >= 1, 'histórico pagamentos');
  assert(pays.pagamentos[0].status === 'confirmado', 'pagamento confirmado');

  console.log('\n--- Cancelamento com acesso até fim do período ---');
  const { data: cancel } = await req('/billing/cancelar', {
    token: tokenPf,
    method: 'POST',
    body: {},
  });
  assert(cancel.ok, 'cancelamento ok');
  assert(cancel.assinatura.status === 'cancelada', 'status cancelada');
  assert(cancel.assinatura.acesso_ate, 'acesso_ate definido');

  console.log('\n--- Inadimplência: atrasada e vencida (30+ dias) ---');
  const emailDel = `test_65_del_${TS}@test.local`;
  await cleanup([emailDel]);
  const uDel = await createUser({
    email: emailDel,
    senha: pass,
    tipo: 'fisica',
    nomePerfil: 'Del 65',
  });
  const tokenDel = await login(emailDel, pass);
  await req('/billing/assinatura', { token: tokenDel });

  const { rows: aRows } = await query('SELECT id FROM assinaturas WHERE usuario_id = $1', [
    uDel.id,
  ]);
  const assinaturaId = aRows[0].id;
  await query(
    `UPDATE assinaturas SET status = 'ativa', fim_em = NOW() + INTERVAL '30 days', trial_ate = NULL WHERE id = $1`,
    [assinaturaId]
  );

  const vencOld = new Date();
  vencOld.setDate(vencOld.getDate() - 35);
  const vencStr = vencOld.toISOString().slice(0, 10);

  await query(
    `INSERT INTO faturas (usuario_id, assinatura_id, gateway, valor_centavos, status, vencimento)
     VALUES ($1, $2, 'asaas', 2990, 'pendente', $3)`,
    [uDel.id, assinaturaId, vencStr]
  );

  await refreshSubscriptionLifecycle(uDel.id);
  const { rows: stDel } = await query('SELECT status FROM assinaturas WHERE id = $1', [
    assinaturaId,
  ]);
  assert(stDel[0].status === 'vencida', 'status vencida após 30+ dias');

  const { data: subDel } = await req('/billing/assinatura', { token: tokenDel });
  assert(
    subDel.assinatura.recursos?._premiumBloqueado === true ||
      subDel.assinatura.avisos?.some((a) => a.includes('vencida')),
    'aviso ou bloqueio premium'
  );

  console.log('\n--- Simulação ainda disponível (não removida) ---');
  const { status: simSt } = await req('/billing/assinatura/simular', {
    token: tokenPj,
    method: 'POST',
    body: { plano_slug: 'pj_pro' },
    allowError: true,
  });
  assert(simSt === 200, 'simular upgrade ainda funciona');

  await cleanup([emailPf, emailPj, emailDel]);
  console.log('\n=== Todos os testes 6.5 passaram ===\n');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  pool.end().finally(() => process.exit(1));
});
