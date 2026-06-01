/**
 * Testes Etapa 5.0B — Vínculo único PJ ↔ PF
 * Uso: node server/test50.js
 */
import { config } from 'dotenv';
config();

import bcrypt from 'bcryptjs';
import { query, pool } from './db.js';
import { createInitialState } from './initialState.js';

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
    `INSERT INTO usuarios (email, senha_hash, nome, role, ativo, tipo_perfil, nome_perfil, email_verificado)
     VALUES ($1,$2,$3,'user',true,$4,$5,true) RETURNING id, email`,
    [email, hash, nomePerfil, tipo, nomePerfil]
  );
  const st = createInitialState(tipo, nomePerfil);
  await query('INSERT INTO estados (usuario_id, dados) VALUES ($1,$2)', [ins.rows[0].id, JSON.stringify(st)]);
  return ins.rows[0];
}

async function login(email, senha) {
  const { data } = await req('/auth/login', { method: 'POST', body: { email, senha } });
  return data.token;
}

async function cleanup(emailPj, emailPf) {
  for (const email of [emailPj, emailPf]) {
    const { rows } = await query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (rows.length) {
      await query('DELETE FROM integracao_pf_pj_vinculo WHERE usuario_pj_id = $1 OR usuario_pf_id = $1', [rows[0].id]);
      await query('DELETE FROM usuarios WHERE id = $1', [rows[0].id]);
    }
  }
}

async function main() {
  console.log('=== Testes Etapa 5.0B — Vínculo PF/PJ ===\n');

  const emailPj = `test_pj_50_${TS}@test.local`;
  const emailPf = `test_pf_50_${TS}@test.local`;
  const pass = 'test123456';

  await cleanup(emailPj, emailPf);

  const pj = await createUser({ email: emailPj, senha: pass, tipo: 'juridica', nomePerfil: 'Empresa Teste 50' });
  const pf = await createUser({ email: emailPf, senha: pass, tipo: 'fisica', nomePerfil: 'PF Teste 50' });

  const tokenPj = await login(emailPj, pass);
  const tokenPf = await login(emailPf, pass);
  assert(!!tokenPj && !!tokenPf, 'Login PJ e PF');

  const busca = await req(`/integracao-pf-pj/buscar-pf?email=${encodeURIComponent(emailPf)}`, { token: tokenPj });
  assert(busca.data.email === emailPf, 'buscar-pf retorna PF');

  const criado = await req('/integracao-pf-pj/vinculo', {
    method: 'POST',
    token: tokenPj,
    body: { email: emailPf },
  });
  assert(criado.data.vinculo?.status === 'pendente', 'POST vinculo → pendente');

  const dup = await req('/integracao-pf-pj/vinculo', {
    method: 'POST',
    token: tokenPj,
    body: { email: emailPf },
    allowError: true,
  });
  assert(dup.status === 409, 'Segundo vínculo PJ rejeitado (409)');

  const pfView = await req('/integracao-pf-pj/vinculo', { token: tokenPf });
  assert(pfView.data.pendentes?.length === 1, 'PF vê convite pendente');

  const aceite = await req('/integracao-pf-pj/aceitar', {
    method: 'POST',
    token: tokenPf,
    body: { vinculoId: criado.data.vinculo.id },
  });
  assert(aceite.data.vinculo?.status === 'ativo', 'PF aceita → ativo');

  const pjView = await req('/integracao-pf-pj/vinculo', { token: tokenPj });
  assert(pjView.data.vinculo?.status === 'ativo', 'PJ vê vínculo ativo');

  const revoga = await req('/integracao-pf-pj/vinculo', { method: 'DELETE', token: tokenPj });
  assert(revoga.data.vinculo?.status === 'revogado', 'PJ revoga vínculo');

  // Novo ciclo com recusa
  const criado2 = await req('/integracao-pf-pj/vinculo', {
    method: 'POST',
    token: tokenPj,
    body: { email: emailPf },
  });
  const recusa = await req('/integracao-pf-pj/recusar', {
    method: 'POST',
    token: tokenPf,
    body: { vinculoId: criado2.data.vinculo.id },
  });
  assert(recusa.data.vinculo?.status === 'revogado', 'PF recusa convite');

  await cleanup(emailPj, emailPf);
  await pool.end();

  console.log('\n=== Todos os testes 5.0B passaram ===');
}

main().catch(async (err) => {
  console.error('\n✗', err.message);
  try { await pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
