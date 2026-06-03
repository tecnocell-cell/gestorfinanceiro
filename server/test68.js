/**
 * Testes correção assinatura PJ x PF (migration 027)
 * npm run test:68
 */
import { config } from 'dotenv';
config();

import bcrypt from 'bcryptjs';
import { query, pool } from './db.js';
import { createInitialState } from './initialState.js';
import { runMigrations } from './migrate.js';
import { corrigirAssinaturaSegmento } from './billing/planoCorrecao.js';

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
  await query('INSERT INTO estados (usuario_id, dados) VALUES ($1,$2)', [
    ins.rows[0].id,
    JSON.stringify(createInitialState(tipo, nomePerfil)),
  ]);
  return ins.rows[0];
}

async function login(email, senha) {
  const { data } = await req('/auth/login', { method: 'POST', body: { email, senha } });
  return data.token;
}

async function cleanup(email) {
  const { rows } = await query('SELECT id FROM usuarios WHERE email = $1', [email]);
  if (!rows.length) return;
  const id = rows[0].id;
  await query('DELETE FROM assinaturas WHERE usuario_id = $1', [id]);
  await query('DELETE FROM estados WHERE usuario_id = $1', [id]);
  await query('DELETE FROM usuarios WHERE id = $1', [id]);
}

async function main() {
  console.log('=== Testes correção plano PJ (027) ===\n');
  await runMigrations();

  const email = `test_68_pj_${TS}@test.local`;
  const pass = 'test123456';
  await cleanup(email);

  const user = await createUser({
    email,
    senha: pass,
    tipo: 'juridica',
    nomePerfil: 'PJ Legado 68',
  });

  const { rows: freePlan } = await query(`SELECT id FROM planos WHERE slug = 'free'`);
  assert(freePlan.length, 'plano free existe (legado)');

  await query(
    `INSERT INTO assinaturas (usuario_id, plano_id, status, inicio_em, trial_ate)
     VALUES ($1, $2, 'trial', NOW(), NOW() + INTERVAL '14 days')`,
    [user.id, freePlan[0].id]
  );

  console.log('--- Simula 024: free → pf_basico (bug histórico) ---');
  const { rows: pfBasico } = await query(`SELECT id FROM planos WHERE slug = 'pf_basico'`);
  await query(`UPDATE assinaturas SET plano_id = $1 WHERE usuario_id = $2`, [
    pfBasico[0].id,
    user.id,
  ]);

  const { rows: before } = await query(
    `SELECT p.slug FROM assinaturas a JOIN planos p ON p.id = a.plano_id WHERE a.usuario_id = $1`,
    [user.id]
  );
  assert(before[0].slug === 'pf_basico', 'PJ legado ficou em pf_basico antes da correção');

  console.log('\n--- Runtime / lógica 027 corrige para pj_start ---');
  const corrected = await corrigirAssinaturaSegmento(user.id);
  assert(corrected === 'pj_start', 'corrigirAssinaturaSegmento retorna pj_start');

  const { rows: afterFix } = await query(
    `SELECT p.slug FROM assinaturas a JOIN planos p ON p.id = a.plano_id WHERE a.usuario_id = $1`,
    [user.id]
  );
  assert(afterFix[0].slug === 'pj_start', 'após correção: PJ em pj_start (nunca pf_basico)');

  const token = await login(email, pass);
  const { data: sub } = await req('/billing/assinatura', { token });
  assert(sub.assinatura?.plano?.slug === 'pj_start', 'API assinatura retorna pj_start');

  const { data: planos } = await req('/billing/planos', { token });
  const slugs = (planos.planos || []).map((p) => p.slug).sort();
  assert(slugs.join(',') === 'pj_business,pj_pro,pj_start', 'API planos PJ completos');
  assert(
    planos.planos.every((p) => p.recursos?.segmento === 'pj' && p.recursos?.integracaoPfPj),
    'cards PJ com recursos preenchidos'
  );

  console.log('\n--- JSON GET /billing/planos (PJ) ---');
  console.log(JSON.stringify(planos, null, 2));

  await cleanup(email);
  console.log('\n=== Testes 68 passaram ===\n');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  pool.end().finally(() => process.exit(1));
});
