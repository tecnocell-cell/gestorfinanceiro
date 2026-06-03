/**
 * Testes Etapa 6.9 — Comunicação real, verificação e config-status
 * npm run test:69
 */
import { config } from 'dotenv';
config();

import bcrypt from 'bcryptjs';
import { query, pool } from './db.js';
import { createInitialState } from './initialState.js';
import { runMigrations } from './migrate.js';
import {
  sendEmail,
  getEmailConfigStatus,
  sanitizeForPublic,
} from './emailProvider.js';
import { criarEnviarOtp, isWhatsappGatewayConfigured } from './authSecurity/otp.js';
import { getSystemConfigStatus } from './system/configStatus.js';

const BASE = `http://127.0.0.1:${process.env.PORT || 3001}/api`;
const TS = Date.now();

const savedEnv = {
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
  SMTP_HOST: process.env.SMTP_HOST,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EVOLUTION_API_URL: process.env.EVOLUTION_API_URL,
  EVOLUTION_API_KEY: process.env.EVOLUTION_API_KEY,
  ASAAS_API_KEY: process.env.ASAAS_API_KEY,
};

function restoreEnv() {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

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

async function createUser({ email, senha, tipo = 'juridica', telefone = '' }) {
  const hash = await bcrypt.hash(senha, 12);
  const ins = await query(
    `INSERT INTO usuarios (
       email, senha_hash, nome, role, ativo, tipo_perfil, nome_perfil,
       email_verificado, telefone_verificado, telefone
     ) VALUES ($1,$2,'Test 69','user',true,$3,'Test 69',true,false,$4)
     RETURNING id, email`,
    [email, hash, tipo, telefone]
  );
  await query('INSERT INTO estados (usuario_id, dados) VALUES ($1,$2)', [
    ins.rows[0].id,
    JSON.stringify(createInitialState(tipo, 'Test 69')),
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
  await query('DELETE FROM convites_empresa WHERE empresa_usuario_id = $1 OR LOWER(email) = LOWER($2)', [
    id,
    email,
  ]);
  await query(
    'DELETE FROM empresa_usuarios WHERE empresa_usuario_id = $1 OR membro_usuario_id = $1',
    [id]
  );
  await query('DELETE FROM otps WHERE usuario_id = $1', [id]);
  await query('DELETE FROM login_audits WHERE usuario_id = $1', [id]);
  await query('DELETE FROM estados WHERE usuario_id = $1', [id]);
  await query('DELETE FROM usuarios WHERE id = $1', [id]);
}

async function main() {
  console.log('=== Testes Etapa 6.9 — Comunicação e config-status ===\n');
  await runMigrations();

  console.log('--- email provider console ---');
  delete process.env.SMTP_HOST;
  delete process.env.RESEND_API_KEY;
  process.env.EMAIL_PROVIDER = 'console';
  const stConsole = getEmailConfigStatus();
  assert(stConsole.provider === 'console', 'provider console');
  assert(!stConsole.configured, 'console não conta como configurado');
  const sent = await sendEmail({
    to: 'test@test.local',
    subject: 'Teste',
    text: 'Corpo teste 123456',
    logLabel: 'TESTE 69',
  });
  assert(sent.sent && sent.dev, 'sendEmail console não quebra');
  assert(sent.provider === 'console', 'retorno provider console');

  console.log('\n--- email sem config não quebra ---');
  delete process.env.EMAIL_PROVIDER;
  delete process.env.SMTP_HOST;
  delete process.env.RESEND_API_KEY;
  const stNone = getEmailConfigStatus();
  assert(!stNone.configured, 'sem credenciais → não configurado');
  const sent2 = await sendEmail({
    to: 'x@test.local',
    subject: 'X',
    text: 'ok',
  });
  assert(sent2.sent, 'fallback console funciona');

  console.log('\n--- OTP por e-mail ---');
  const emailOtp = `test_69_otp_${TS}@test.local`;
  await cleanup(emailOtp);
  const uOtp = await createUser({ email: emailOtp, senha: 'test123456' });
  const otpSent = await criarEnviarOtp({
    usuarioId: uOtp.id,
    tipo: 'acao_sensivel',
    canalPreferido: 'email',
  });
  assert(otpSent.otp_id, 'OTP email otp_id');
  assert(otpSent.canal === 'email', 'canal email');

  console.log('\n--- fallback WhatsApp → e-mail ---');
  delete process.env.EVOLUTION_API_URL;
  delete process.env.EVOLUTION_API_KEY;
  assert(!isWhatsappGatewayConfigured(), 'WhatsApp gateway off');
  const otpWa = await criarEnviarOtp({
    usuarioId: uOtp.id,
    tipo: 'verificar_telefone',
    canalPreferido: 'whatsapp',
  });
  assert(otpWa.fallback || otpWa.canal === 'email', 'fallback para e-mail');
  assert(otpWa.aviso || otpWa.canal === 'email', 'aviso de fallback');

  console.log('\n--- config-status não vaza segredo ---');
  process.env.ASAAS_API_KEY = 'secret_asaas_test_key';
  process.env.RESEND_API_KEY = 're_secret_test';
  const status = await getSystemConfigStatus();
  const json = JSON.stringify(status);
  assert(!json.includes('secret_asaas'), 'sem ASAAS key');
  assert(!json.includes('re_secret'), 'sem Resend key');
  const pub = sanitizeForPublic(status);
  assert(pub.email?.provider !== undefined, 'email provider exposto');
  assert(!pub.email?.apiKey, 'sem apiKey em email');

  const { data: apiStatus } = await req('/system/config-status');
  const apiJson = JSON.stringify(apiStatus);
  assert(!apiJson.includes('secret_asaas'), 'API sem segredo Asaas');
  assert(typeof apiStatus.email?.configured === 'boolean', 'email.configured boolean');
  assert(typeof apiStatus.whatsapp?.configured === 'boolean', 'whatsapp.configured boolean');
  assert(typeof apiStatus.billing?.configured === 'boolean', 'billing.configured boolean');

  console.log('\n--- convite equipe e-mail indisponível retorna token ---');
  delete process.env.EMAIL_PROVIDER;
  delete process.env.SMTP_HOST;
  delete process.env.RESEND_API_KEY;

  const ownerEmail = `test_69_owner_${TS}@test.local`;
  const inviteEmail = `test_69_inv_${TS}@test.local`;
  await cleanup(ownerEmail);
  await cleanup(inviteEmail);
  const owner = await createUser({ email: ownerEmail, senha: 'test123456', tipo: 'juridica' });
  const token = await login(ownerEmail, 'test123456');

  const conv = await req('/empresa/convidar', {
    method: 'POST',
    token,
    body: { email: inviteEmail, perfil: 'operador' },
  });
  assert(conv.data.ok, 'convite ok');
  assert(conv.data.email_sent === false, 'email_sent false sem SMTP');
  assert(conv.data.manual_token || conv.data.dev_token, 'token manual/dev retornado');

  restoreEnv();
  await cleanup(emailOtp);
  await cleanup(ownerEmail);
  await cleanup(inviteEmail);

  console.log('\n=== Testes 6.9 passaram ===\n');
}

main()
  .catch((err) => {
    restoreEnv();
    console.error('\n❌', err.message);
    process.exit(1);
  })
  .finally(() => pool.end());
