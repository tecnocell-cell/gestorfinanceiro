/**
 * Teste Etapa 6.4 — Open Finance provider Pluggy
 * Uso: npm run test:64  (API em http://127.0.0.1:3001)
 */
import { config } from 'dotenv';
config();

import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { query, pool } from './db.js';
import { createInitialState } from './initialState.js';
import { runMigrations } from './migrate.js';

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
     VALUES ($1,$2,$3,'user',true,$4,$5,true) RETURNING id`,
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
    if (rows.length) await query('DELETE FROM usuarios WHERE id = $1', [rows[0].id]);
  }
}

async function testConfigModule() {
  console.log('--- Config Pluggy (módulo) ---');
  const saved = {
    OPENFINANCE_PROVIDER: process.env.OPENFINANCE_PROVIDER,
    OPENFINANCE_CLIENT_ID: process.env.OPENFINANCE_CLIENT_ID,
    OPENFINANCE_CLIENT_SECRET: process.env.OPENFINANCE_CLIENT_SECRET,
    OPENFINANCE_BASE_URL: process.env.OPENFINANCE_BASE_URL,
  };

  process.env.OPENFINANCE_PROVIDER = 'pluggy';
  delete process.env.OPENFINANCE_CLIENT_ID;
  delete process.env.OPENFINANCE_CLIENT_SECRET;
  process.env.OPENFINANCE_BASE_URL = 'https://api.pluggy.ai';

  const { getOpenFinanceConfig } = await import('./openFinance/config.js');
  const incomplete = getOpenFinanceConfig();
  assert(incomplete.provider === 'pluggy', 'config: provider pluggy');
  assert(incomplete.pluggyReady === false, 'config: pluggyReady false sem credenciais');
  assert(incomplete.canStartPluggyConnect === false, 'config: canStartPluggyConnect false');

  process.env.OPENFINANCE_CLIENT_ID = 'test-client';
  process.env.OPENFINANCE_CLIENT_SECRET = 'test-secret';
  const complete = getOpenFinanceConfig();
  assert(complete.pluggyReady === true, 'config: pluggyReady true com credenciais');
  assert(complete.canStartPluggyConnect === true, 'config: canStartPluggyConnect true');

  const { startPluggyConnect } = await import('./openFinance/providers/pluggy.js');
  const { resetPluggyAuthCache } = await import('./openFinance/providers/pluggyHttp.js');
  resetPluggyAuthCache();
  let pluggyStartFailed = false;
  try {
    await startPluggyConnect({ clientUserId: 'u1' });
  } catch {
    pluggyStartFailed = true;
  }
  assert(pluggyStartFailed, 'startPluggyConnect falha sem API Pluggy válida (credenciais de teste)');

  if (saved.OPENFINANCE_PROVIDER !== undefined) process.env.OPENFINANCE_PROVIDER = saved.OPENFINANCE_PROVIDER;
  else delete process.env.OPENFINANCE_PROVIDER;
  if (saved.OPENFINANCE_CLIENT_ID !== undefined) process.env.OPENFINANCE_CLIENT_ID = saved.OPENFINANCE_CLIENT_ID;
  else delete process.env.OPENFINANCE_CLIENT_ID;
  if (saved.OPENFINANCE_CLIENT_SECRET !== undefined) {
    process.env.OPENFINANCE_CLIENT_SECRET = saved.OPENFINANCE_CLIENT_SECRET;
  } else delete process.env.OPENFINANCE_CLIENT_SECRET;
  if (saved.OPENFINANCE_BASE_URL !== undefined) process.env.OPENFINANCE_BASE_URL = saved.OPENFINANCE_BASE_URL;
  else delete process.env.OPENFINANCE_BASE_URL;
}

async function testHttpMockMode(token) {
  console.log('--- API (modo servidor atual) ---');
  const { data: st } = await req('/open-finance/status', { token });
  assert(st.enabled === true, 'status: enabled');
  assert(typeof st.providerLabel === 'string', 'status: providerLabel');
  assert(typeof st.canStartPluggyConnect === 'boolean', 'status: canStartPluggyConnect');
  assert(typeof st.credentialsMissing === 'boolean', 'status: credentialsMissing');

  const { status: initStatus, data: initData } = await req('/open-finance/connect/init', {
    token,
    method: 'POST',
    body: {},
    allowError: true,
  });

  if (st.demoMode) {
    assert(initStatus === 422, 'connect/init bloqueado em modo mock (422)');
    assert(initData.error, 'connect/init mensagem de erro');
    const { data: mockConn } = await req('/open-finance/connections/mock', {
      token,
      method: 'POST',
      body: {},
    });
    assert(mockConn.connection?.id, 'mock: conexão demo criada');
    assert(
      (mockConn.connection?.institutionName || '').includes('Demo') ||
        mockConn.provider === 'mock',
      'mock: instituição demo'
    );
    await req(`/open-finance/connections/${mockConn.connection.id}`, {
      token,
      method: 'DELETE',
    });
  } else if (st.canStartPluggyConnect) {
    assert(initStatus === 200, 'connect/init OK com pluggy configurado');
    assert(initData.connectToken, 'connect/init retorna connectToken');
  } else if (st.credentialsMissing) {
    assert(initStatus === 503, 'connect/init 503 sem credenciais pluggy');
  }

  const { status: pluggyComplete } = await req('/open-finance/connections/pluggy', {
    token,
    method: 'POST',
    body: {},
    allowError: true,
  });
  assert(pluggyComplete === 400, 'connections/pluggy exige itemId (400)');
}

async function main() {
  console.log('=== Teste 64 — Open Finance Pluggy ===\n');

  await runMigrations();
  await testConfigModule();

  const email = `t64-${TS}@test.local`;
  const senha = 'Test@1234';
  await cleanup([email]);

  const user = await createUser({
    email,
    senha,
    tipo: 'juridica',
    nomePerfil: 'PJ T64',
  });
  const token = await login(email, senha);

  await testHttpMockMode(token);

  await cleanup([email]);
  console.log('\n=== Teste 64: todos os testes passaram ===\n');
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error('\n=== Teste 64 FALHOU ===\n', err.message);
    pool.end().finally(() => process.exit(1));
  });
