/**
 * Testes Etapa 6.2 — Segurança e verificação de conta
 * Uso: node server/test62.js
 * Requer servidor rodando: npm run server
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

async function createUser({ email, senha, verified = true }) {
  const hash = await bcrypt.hash(senha, 12);
  const ins = await query(
    `INSERT INTO usuarios (
       email, senha_hash, nome, role, ativo, tipo_perfil, nome_perfil,
       email_verificado, telefone_verificado
     )
     VALUES ($1,$2,$3,'user',true,'fisica',$3,$4,false)
     RETURNING id, email`,
    [email, hash, 'Teste Seg', verified]
  );
  const st = createInitialState('fisica', 'Teste Seg');
  await query('INSERT INTO estados (usuario_id, dados) VALUES ($1,$2)', [
    ins.rows[0].id,
    JSON.stringify(st),
  ]);
  return ins.rows[0];
}

async function login(email, senha, allowError = false) {
  return req('/auth/login', { method: 'POST', body: { email, senha }, allowError });
}

async function cleanup(emails) {
  for (const email of emails) {
    const { rows } = await query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (!rows.length) continue;
    const id = rows[0].id;
    await query('DELETE FROM otps WHERE usuario_id = $1', [id]);
    await query('DELETE FROM login_audits WHERE usuario_id = $1', [id]);
    await query('DELETE FROM password_resets WHERE usuario_id = $1', [id]);
    await query('DELETE FROM verificacoes WHERE usuario_id = $1', [id]);
    await query('DELETE FROM estados WHERE usuario_id = $1', [id]);
    await query('DELETE FROM usuarios WHERE id = $1', [id]);
  }
}

async function main() {
  console.log('=== Testes Etapa 6.2 — Segurança de conta ===\n');

  const email = `test_62_${TS}@test.local`;
  const pass = 'test123456';
  const newPass = 'nova654321';

  await cleanup([email]);

  const user = await createUser({ email, senha: pass, verified: false });
  const tokenLogin = (await login(email, pass)).data.token;

  console.log('--- Verificação de e-mail (token) ---');

  const send = await req('/auth/send-verification', {
    method: 'POST',
    token: tokenLogin,
    body: {},
  });
  assert(send.data.ok, 'send-verification retorna ok');
  assert(send.data.dev_token, 'dev_token no ambiente de teste');
  const verifyToken = send.data.dev_token;

  const verify = await req('/auth/verify-email', {
    method: 'POST',
    body: { token: verifyToken },
  });
  assert(verify.data.ok, 'verify-email confirma token');

  const { rows: afterVerify } = await query(
    'SELECT email_verificado, email_verificado_em FROM usuarios WHERE id = $1',
    [user.id]
  );
  assert(afterVerify[0].email_verificado === true, 'email_verificado = true');
  assert(afterVerify[0].email_verificado_em, 'email_verificado_em preenchido');

  const dupSend = await req('/auth/send-verification', {
    method: 'POST',
    token: tokenLogin,
    body: {},
    allowError: true,
  });
  assert(dupSend.status === 400, 'send-verification bloqueia e-mail já verificado');

  console.log('\n--- Recuperação de senha ---');

  const forgot = await req('/auth/forgot-password', {
    method: 'POST',
    body: { email },
  });
  assert(forgot.data.ok, 'forgot-password retorna ok');
  assert(forgot.data.dev_token, 'dev_token recuperação');

  const reset = await req('/auth/reset-password', {
    method: 'POST',
    body: { token: forgot.data.dev_token, nova_senha: newPass },
  });
  assert(reset.data.ok, 'reset-password redefine senha');

  const oldLogin = await login(email, pass, true);
  assert(oldLogin.status === 401, 'senha antiga rejeitada após reset');

  const newLogin = await login(email, newPass);
  assert(newLogin.data.token, 'login com nova senha');

  console.log('\n--- Auditoria de login ---');

  const { rows: audits } = await query(
    `SELECT sucesso FROM login_audits WHERE usuario_id = $1 ORDER BY created_at`,
    [user.id]
  );
  assert(audits.some((a) => a.sucesso === true), 'auditoria registra login com sucesso');
  assert(audits.some((a) => a.sucesso === false), 'auditoria registra login inválido');

  const sec = await req('/auth/security', { token: newLogin.data.token });
  assert(sec.data.email_verificado === true, 'GET /auth/security — e-mail verificado');
  assert(sec.data.ultimo_login?.em, 'GET /auth/security — último login');

  console.log('\n--- Bloqueio por tentativas ---');

  const emailLock = `test_62_lock_${TS}@test.local`;
  await cleanup([emailLock]);
  await createUser({ email: emailLock, senha: pass, verified: true });

  for (let i = 0; i < 5; i++) {
    const fail = await login(emailLock, 'wrong-pass', true);
    assert(fail.status === 401, `tentativa ${i + 1} falha com 401`);
  }

  const locked = await login(emailLock, pass, true);
  assert(locked.status === 429, '6ª tentativa (login válido) bloqueada com 429');

  const { rows: lockRow } = await query(
    'SELECT tentativas_login, bloqueado_ate FROM usuarios WHERE email = $1',
    [emailLock]
  );
  assert(lockRow[0].tentativas_login >= 5, 'tentativas_login >= 5');
  assert(lockRow[0].bloqueado_ate, 'bloqueado_ate definido');

  await cleanup([email, emailLock]);
  await pool.end();

  console.log('\n=== Todos os testes 6.2 passaram ===\n');
}

main().catch((err) => {
  console.error(err);
  pool.end().finally(() => process.exit(1));
});
