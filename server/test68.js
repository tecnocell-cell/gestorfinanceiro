/**
 * Testes Etapa 6.8 — OTP e-mail/WhatsApp
 * npm run test:68
 */
import { config } from 'dotenv';
config();

import bcrypt from 'bcryptjs';
import { query, pool } from './db.js';
import { createInitialState } from './initialState.js';
import { runMigrations } from './migrate.js';
import {
  gerarOtp,
  criarEnviarOtp,
  validarOtp,
  isWhatsappGatewayConfigured,
} from './authSecurity/otp.js';

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

async function createUser({ email, senha, telefone = '' }) {
  const hash = await bcrypt.hash(senha, 12);
  const ins = await query(
    `INSERT INTO usuarios (
       email, senha_hash, nome, role, ativo, tipo_perfil, nome_perfil,
       email_verificado, telefone_verificado, telefone
     ) VALUES ($1,$2,'OTP Test','user',true,'fisica','OTP Test',true,false,$3)
     RETURNING id, email`,
    [email, hash, telefone]
  );
  await query('INSERT INTO estados (usuario_id, dados) VALUES ($1,$2)', [
    ins.rows[0].id,
    JSON.stringify(createInitialState('fisica', 'OTP Test')),
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
  await query('DELETE FROM otps WHERE usuario_id = $1', [id]);
  await query('DELETE FROM login_audits WHERE usuario_id = $1', [id]);
  await query('DELETE FROM estados WHERE usuario_id = $1', [id]);
  await query('DELETE FROM usuarios WHERE id = $1', [id]);
}

async function main() {
  console.log('=== Testes Etapa 6.8 — OTP ===\n');
  await runMigrations();

  const email = `test_68_otp_${TS}@test.local`;
  const pass = 'test123456';
  await cleanup(email);
  const user = await createUser({ email, senha: pass, telefone: '5599999887766' });

  console.log('--- gerarOtp (hash, nunca código puro persistido) ---');
  const gen = await gerarOtp();
  assert(/^\d{6}$/.test(gen.codigo), 'código tem 6 dígitos');
  assert(gen.codigoHash !== gen.codigo, 'hash difere do código');
  assert(gen.codigoHash.startsWith('$2'), 'hash bcrypt');

  console.log('\n--- criarEnviarOtp + validar OTP correto ---');
  const sent = await criarEnviarOtp({
    usuarioId: user.id,
    tipo: 'acao_sensivel',
    canalPreferido: 'email',
  });
  assert(sent.otp_id, 'otp_id retornado');
  assert(sent.dev_codigo, 'dev_codigo em ambiente de teste');

  const { rows: dbOtp } = await query(
    'SELECT codigo_hash FROM otps WHERE id = $1',
    [sent.otp_id]
  );
  assert(dbOtp[0].codigo_hash !== sent.dev_codigo, 'banco não armazena código puro');

  const ok = await validarOtp({
    otpId: sent.otp_id,
    usuarioId: user.id,
    tipo: 'acao_sensivel',
    codigo: sent.dev_codigo,
  });
  assert(ok.ok, 'valida OTP correto');

  console.log('\n--- rejeita OTP expirado ---');
  const sent2 = await criarEnviarOtp({
    usuarioId: user.id,
    tipo: 'acao_sensivel',
    canalPreferido: 'email',
  });
  await query(`UPDATE otps SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1`, [
    sent2.otp_id,
  ]);
  const expired = await validarOtp({
    otpId: sent2.otp_id,
    usuarioId: user.id,
    tipo: 'acao_sensivel',
    codigo: sent2.dev_codigo,
  });
  assert(!expired.ok && expired.error.includes('expirado'), 'rejeita OTP expirado');

  console.log('\n--- rejeita após tentativas erradas ---');
  const sent3 = await criarEnviarOtp({
    usuarioId: user.id,
    tipo: 'acao_sensivel',
    canalPreferido: 'email',
  });
  for (let i = 0; i < 5; i++) {
    await validarOtp({
      otpId: sent3.otp_id,
      usuarioId: user.id,
      tipo: 'acao_sensivel',
      codigo: '000000',
    });
  }
  const blocked = await validarOtp({
    otpId: sent3.otp_id,
    usuarioId: user.id,
    tipo: 'acao_sensivel',
    codigo: sent3.dev_codigo,
  });
  assert(!blocked.ok && blocked.error.includes('tentativas'), 'bloqueia após 5 tentativas');

  console.log('\n--- fallback e-mail se WhatsApp não configurado ---');
  await query('DELETE FROM otps WHERE usuario_id = $1', [user.id]);
  const waConfigured = isWhatsappGatewayConfigured();
  const sentWa = await criarEnviarOtp({
    usuarioId: user.id,
    tipo: 'verificar_telefone',
    canalPreferido: 'whatsapp',
  });
  if (!waConfigured) {
    assert(sentWa.canal === 'email', 'fallback para e-mail sem gateway WhatsApp');
    assert(sentWa.fallback === true || sentWa.aviso, 'aviso de fallback');
  } else {
    assert(['email', 'whatsapp'].includes(sentWa.canal), 'canal válido com gateway');
  }

  console.log('\n--- API POST /auth/otp/send e /verify ---');
  await query('DELETE FROM otps WHERE usuario_id = $1', [user.id]);
  const token = await login(email, pass);
  const apiSend = await req('/auth/otp/send', {
    method: 'POST',
    token,
    body: { tipo: 'acao_sensivel', canal: 'email' },
  });
  assert(apiSend.data.otp_id, 'API send retorna otp_id');
  assert(apiSend.data.dev_codigo, 'API send dev_codigo');

  const apiVerify = await req('/auth/otp/verify', {
    method: 'POST',
    token,
    body: {
      otp_id: apiSend.data.otp_id,
      codigo: apiSend.data.dev_codigo,
      tipo: 'acao_sensivel',
    },
  });
  assert(apiVerify.data.verified, 'API verify confirma código');

  console.log('\n--- change-password exige OTP ---');
  const noOtp = await req('/auth/change-password', {
    method: 'PATCH',
    token,
    body: { senha_atual: pass, nova_senha: 'nova654321' },
    allowError: true,
  });
  assert(noOtp.status === 400 && noOtp.data.requires_otp, 'change-password exige OTP');

  await cleanup(email);
  console.log('\n=== Testes 6.8 passaram ===\n');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  pool.end().finally(() => process.exit(1));
});
