/**
 * Teste Etapa 6.1 — Open Finance MVP
 * Uso: npm run test:61  (API em http://127.0.0.1:3001, migrations aplicadas)
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
  const emp = st.empresas[0];
  const manualId = randomUUID();
  emp.lancamentos = [
    {
      id: manualId,
      codigo: 1,
      data: '2026-01-15',
      tipo: 'Entrada',
      valor: 999.99,
      historico: 'Lançamento manual T61',
      planoId: emp.planoContas[0]?.id || '',
      contaEntradaId: emp.contas[0]?.id,
      contaSaidaId: null,
      pago: true,
      source: 'manual',
    },
  ];
  await query('INSERT INTO estados (usuario_id, dados) VALUES ($1,$2)', [
    ins.rows[0].id,
    JSON.stringify(st),
  ]);
  return { ...ins.rows[0], manualLancamentoId: manualId, contaId: emp.contas[0]?.id };
}

async function login(email, senha) {
  const { data } = await req('/auth/login', { method: 'POST', body: { email, senha } });
  return data.token;
}

async function countLancamentos(usuarioId) {
  const { rows } = await query('SELECT dados FROM estados WHERE usuario_id = $1', [usuarioId]);
  const emp = rows[0]?.dados?.empresas?.[0];
  return (emp?.lancamentos || []).length;
}

async function getLancamentos(usuarioId) {
  const { rows } = await query('SELECT dados FROM estados WHERE usuario_id = $1', [usuarioId]);
  const emp = rows[0]?.dados?.empresas?.[0];
  return emp?.lancamentos || [];
}

async function cleanup(emails) {
  for (const email of emails) {
    const { rows } = await query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (rows.length) {
      await query('DELETE FROM usuarios WHERE id = $1', [rows[0].id]);
    }
  }
}

async function main() {
  console.log('=== Teste 61 — Open Finance MVP ===\n');

  await runMigrations();

  const emailA = `t61-a-${TS}@test.local`;
  const emailB = `t61-b-${TS}@test.local`;
  const senha = 'Test@1234';

  await cleanup([emailA, emailB]);

  const userA = await createUser({
    email: emailA,
    senha,
    tipo: 'juridica',
    nomePerfil: 'PJ T61',
  });
  const userB = await createUser({
    email: emailB,
    senha,
    tipo: 'juridica',
    nomePerfil: 'PJ T61 B',
  });

  const tokenA = await login(emailA, senha);
  const tokenB = await login(emailB, senha);

  const { data: moduleStatus } = await req('/open-finance/status', { token: tokenA });
  assert(moduleStatus.enabled === true, 'status: módulo habilitado');
  assert(moduleStatus.demoMode === true || moduleStatus.provider === 'mock', 'status: mock/demo');

  const { data: created } = await req('/open-finance/connections/mock', {
    token: tokenA,
    method: 'POST',
    body: {},
  });
  assert(created.connection?.id, 'criar conexão mock');
  const connId = created.connection.id;
  assert((created.accounts || []).length >= 1, 'conexão mock com contas');

  const countBefore = await countLancamentos(userA.id);
  assert(countBefore === 1, 'estado inicial: 1 lançamento manual');

  const { data: sync1 } = await req(`/open-finance/connections/${connId}/sync`, {
    token: tokenA,
    method: 'POST',
    body: { contaId: userA.contaId },
  });
  assert(sync1.imported >= 2, `primeira sync importa transações (got ${sync1.imported})`);

  const lancsAfter1 = await getLancamentos(userA.id);
  assert(lancsAfter1.length === countBefore + sync1.imported, 'lançamentos adicionados na sync');

  const manual = lancsAfter1.find((l) => l.id === userA.manualLancamentoId);
  assert(manual && manual.valor === 999.99, 'lançamento manual preservado');
  assert(manual.source === 'manual' || !manual.openFinance, 'manual sem openFinance');

  const ofLancs = lancsAfter1.filter((l) => l.source === 'open_finance');
  assert(ofLancs.length === sync1.imported, 'lançamentos com source open_finance');
  const entrada = ofLancs.find((l) => l.tipo === 'Entrada');
  const saida = ofLancs.find((l) => l.tipo === 'Saida');
  assert(entrada && entrada.valor > 0, 'há lançamento Entrada');
  assert(saida && saida.tipo === 'Saida', 'há lançamento Saida');
  assert(entrada.openFinance?.connectionId === connId, 'openFinance.connectionId no lançamento');

  const { data: sync2 } = await req(`/open-finance/connections/${connId}/sync`, {
    token: tokenA,
    method: 'POST',
    body: { contaId: userA.contaId },
  });
  assert(sync2.imported === 0, 'segunda sync não reimporta (dedup)');
  assert(sync2.skipped >= sync1.imported, 'segunda sync ignora duplicatas');

  const countAfter2 = await countLancamentos(userA.id);
  assert(countAfter2 === lancsAfter1.length, 'total de lançamentos estável após dedup');

  const { data: txList } = await req('/open-finance/transactions', { token: tokenA });
  assert((txList.transactions || []).length >= sync1.imported, 'GET transactions lista importadas');

  const { status: forbidden } = await req(`/open-finance/connections/${connId}/sync`, {
    token: tokenB,
    method: 'POST',
    body: { contaId: userB.contaId },
    allowError: true,
  });
  assert(forbidden === 404, 'ownership: outro usuário não sincroniza conexão alheia');

  const { status: delForbidden } = await req(`/open-finance/connections/${connId}`, {
    token: tokenB,
    method: 'DELETE',
    allowError: true,
  });
  assert(delForbidden === 404, 'ownership: outro usuário não remove conexão alheia');

  const { data: logs } = await req(`/open-finance/sync-logs?connectionId=${connId}`, {
    token: tokenA,
  });
  assert((logs.logs || []).length >= 2, 'histórico de sincronização');

  await cleanup([emailA, emailB]);
  console.log('\n=== Teste 61: todos os testes passaram ===\n');
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error('\n=== Teste 61 FALHOU ===\n', err.message);
    pool.end().finally(() => process.exit(1));
  });
