/**
 * Testes Etapa 6.3 — Planos e assinaturas
 * Uso: node server/test63.js
 * Requer servidor rodando: npm run server
 */
import { config } from 'dotenv';
config();

import bcrypt from 'bcryptjs';
import { query, pool } from './db.js';
import { createInitialState } from './initialState.js';
import { mergeRecursos, DEFAULT_RESOURCES_BY_SLUG } from './billing/planResources.js';

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

async function createUser({ email, senha }) {
  const hash = await bcrypt.hash(senha, 12);
  const ins = await query(
    `INSERT INTO usuarios (
       email, senha_hash, nome, role, ativo, tipo_perfil, nome_perfil, email_verificado
     ) VALUES ($1,$2,$3,'user',true,'fisica',$3,true) RETURNING id, email`,
    [email, hash, 'Teste Billing']
  );
  const st = createInitialState('fisica', 'Teste Billing');
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
    await query('DELETE FROM assinaturas WHERE usuario_id = $1', [id]);
    await query('DELETE FROM estados WHERE usuario_id = $1', [id]);
    await query('DELETE FROM usuarios WHERE id = $1', [id]);
  }
}

async function main() {
  console.log('=== Testes Etapa 6.3 — Planos e assinaturas ===\n');

  const email = `test_63_${TS}@test.local`;
  const pass = 'test123456';
  await cleanup([email]);

  console.log('--- Planos seedados ---');
  const { rows: planosDb } = await query(
    `SELECT slug, recursos FROM planos WHERE ativo = true ORDER BY preco_centavos`
  );
  assert(planosDb.length >= 3, 'pelo menos 3 planos no banco');
  const slugs = planosDb.map((p) => p.slug);
  assert(slugs.includes('free'), 'plano free seedado');
  assert(slugs.includes('pro'), 'plano pro seedado');
  assert(slugs.includes('empresarial'), 'plano empresarial seedado');

  const freeRec = mergeRecursos('free', planosDb.find((p) => p.slug === 'free').recursos);
  assert(freeRec.openFinance === false, 'free: openFinance false');
  assert(freeRec.limiteLancamentos === 100, 'free: limite 100');

  const proRec = mergeRecursos('pro', planosDb.find((p) => p.slug === 'pro').recursos);
  assert(proRec.openFinance === true, 'pro: openFinance true');
  assert(proRec.integracaoPfPj === true, 'pro: integracaoPfPj true');

  const empRec = mergeRecursos(
    'empresarial',
    planosDb.find((p) => p.slug === 'empresarial').recursos
  );
  assert(empRec.limiteLancamentos === null, 'empresarial: lançamentos ilimitados');
  assert(empRec.suportePrioritario === true, 'empresarial: suporte prioritário');

  assert(
    DEFAULT_RESOURCES_BY_SLUG.pro.limiteLancamentos === 2000,
    'helper recursos pro limite 2000'
  );

  const user = await createUser({ email, senha: pass });
  const token = await login(email, pass);

  console.log('\n--- API planos ---');
  const list = await req('/billing/planos', { token });
  assert(list.data.planos?.length >= 3, 'GET /billing/planos retorna planos');
  assert(list.data.pagamentos_reais === false, 'flag pagamentos_reais false');

  console.log('\n--- Assinatura padrão Free/trial ---');
  const sub1 = await req('/billing/assinatura', { token });
  assert(sub1.data.assinatura?.plano?.slug === 'free', 'sem assinatura → Free');
  assert(sub1.data.assinatura?.status === 'trial', 'status trial padrão');
  assert(sub1.data.assinatura?.trial_ate, 'trial_ate definido');
  assert(sub1.data.assinatura?.recursos?.limiteLancamentos === 100, 'recursos free na assinatura');

  const { rows: assDb } = await query('SELECT id FROM assinaturas WHERE usuario_id = $1', [
    user.id,
  ]);
  assert(assDb.length === 1, 'assinatura criada no banco');

  console.log('\n--- Simular upgrade ---');
  const up = await req('/billing/assinatura/simular', {
    method: 'POST',
    token,
    body: { plano_slug: 'pro' },
  });
  assert(up.data.ok, 'simular upgrade ok');
  assert(up.data.assinatura?.plano?.slug === 'pro', 'plano atualizado para pro');
  assert(up.data.assinatura?.status === 'ativa', 'status ativa após simulação');
  assert(up.data.assinatura?.recursos?.openFinance === true, 'recursos pro após upgrade');

  const sub2 = await req('/billing/assinatura', { token });
  assert(sub2.data.assinatura?.plano?.slug === 'pro', 'GET assinatura confirma pro');

  const bad = await req('/billing/assinatura/simular', {
    method: 'POST',
    token,
    body: { plano_slug: 'inexistente' },
    allowError: true,
  });
  assert(bad.status === 400, 'slug inválido retorna 400');

  await cleanup([email]);
  await pool.end();

  console.log('\n=== Todos os testes 6.3 passaram ===\n');
}

main().catch((err) => {
  console.error(err);
  pool.end().finally(() => process.exit(1));
});
