/**
 * FASE 1 — Fluxiva Multiambiente: 10 testes obrigatórios
 *
 * Testa:
 * 1.  Tabela ambientes_financeiros existe
 * 2.  ensureAmbientePrincipal cria ambiente para usuário novo (PF → Pessoal)
 * 3.  ensureAmbientePrincipal é idempotente
 * 4.  ensureAmbientePrincipal cria tipo 'empresa' para PJ
 * 5.  listAmbientes retorna lista correta
 * 6.  createAmbiente cria segundo ambiente
 * 7.  GET /api/state injeta dados.ambientes e dados.ambienteAtualId
 * 8.  PUT /api/state strip dados.ambientes (não persiste no banco)
 * 9.  POST /api/ambientes/:id/selecionar persiste ambienteAtualId
 * 10. Cadastro via /api/auth/register cria ambiente automaticamente
 */
import { config } from 'dotenv';
config();

import { query, pool } from './db.js';
import { runMigrations } from './migrate.js';
import {
  ensureAmbientePrincipal,
  listAmbientes,
  createAmbiente,
  getAmbientePrincipal,
} from './ambientes/ambientesService.js';

const BASE = 'http://localhost:3001';
const TS   = Date.now();
const PASS = 'Teste123!';
let passed = 0, failed = 0;

function ok(label, val) {
  if (val) { console.log(`  ✓ ${label}`); passed++; }
  else      { console.error(`  ✗ ${label}`); failed++; }
}

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method:  opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function insertTestUser(email, tipoPerfil = 'fisica', nomePerfil = 'Teste') {
  const bcrypt = (await import('bcryptjs')).default;
  const hash = await bcrypt.hash(PASS, 4);
  const { rows } = await query(
    `INSERT INTO usuarios (email, senha_hash, nome, role, ativo, tipo_perfil, nome_perfil,
                           email_verificado, telefone_verificado)
     VALUES ($1, $2, $3, 'user', true, $4, $5, true, false)
     RETURNING id`,
    [email, hash, nomePerfil, tipoPerfil, nomePerfil]
  );
  const userId = rows[0].id;
  await query(
    `INSERT INTO estados (usuario_id, dados) VALUES ($1, $2)`,
    [userId, JSON.stringify({ empresas: [{ id: 'e1', nome: nomePerfil, lancamentos: [], contas: [], planoContas: [] }], empresaAtivaId: 'e1', filterPeriodo: { ano: 2025, mes: null } })]
  );
  // cria assinatura básica para passar subscriptionGuard
  const { rows: planos } = await query(`SELECT id FROM planos WHERE slug = $1 LIMIT 1`, [tipoPerfil === 'fisica' ? 'pf_basico' : 'pj_basico']);
  if (planos.length) {
    const trialAte = new Date(); trialAte.setDate(trialAte.getDate() + 7);
    await query(
      `INSERT INTO assinaturas (usuario_id, plano_id, status, inicio_em, trial_ate)
       VALUES ($1, $2, 'trial', NOW(), $3) ON CONFLICT DO NOTHING`,
      [userId, planos[0].id, trialAte]
    );
  }
  return userId;
}

async function cleanupUser(email) {
  const { rows } = await query('SELECT id FROM usuarios WHERE email = $1', [email]);
  if (!rows.length) return;
  const id = rows[0].id;
  await query('DELETE FROM ambientes_financeiros WHERE usuario_id = $1', [id]);
  await query('DELETE FROM assinaturas WHERE usuario_id = $1', [id]);
  await query('DELETE FROM estados WHERE usuario_id = $1', [id]);
  await query('DELETE FROM usuarios WHERE id = $1', [id]);
}

async function login(email) {
  const { data } = await req('/auth/login', { method: 'POST', body: { email, senha: PASS } });
  return data.token || null;
}

// ─── Setup ────────────────────────────────────────────────────────────────────
await runMigrations();

const emailPF  = `amb_pf_${TS}@test.local`;
const emailPJ  = `amb_pj_${TS}@test.local`;
const emailNew = `amb_new_${TS}@test.local`;
await cleanupUser(emailPF);
await cleanupUser(emailPJ);
await cleanupUser(emailNew);

console.log('\n=== FASE 1 — Multiambiente: 10 testes ===\n');

// ── 1. Tabela existe ──────────────────────────────────────────────────────────
console.log('── 1. Tabela ambientes_financeiros existe ──');
{
  const { rows } = await query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'ambientes_financeiros'`
  );
  ok('tabela criada pela migration', rows.length === 1);
}

// ── 2. ensureAmbientePrincipal PF → tipo pessoal ─────────────────────────────
console.log('\n── 2. ensureAmbientePrincipal cria ambiente pessoal (PF) ──');
const userIdPF = await insertTestUser(emailPF, 'fisica', 'João Silva');
{
  const amb = await ensureAmbientePrincipal(userIdPF, 'fisica', 'João Silva');
  ok('retornou objeto com id', !!amb?.id);
  ok('tipo = pessoal', amb?.tipo === 'pessoal');

  const { rows } = await query(
    `SELECT nome, tipo FROM ambientes_financeiros WHERE usuario_id = $1 AND ativo = true`,
    [userIdPF]
  );
  ok('persisted no banco', rows.length === 1);
  ok('nome = João Silva', rows[0]?.nome === 'João Silva');
  ok('tipo no banco = pessoal', rows[0]?.tipo === 'pessoal');
}

// ── 3. Idempotência ───────────────────────────────────────────────────────────
console.log('\n── 3. ensureAmbientePrincipal é idempotente ──');
{
  await ensureAmbientePrincipal(userIdPF, 'fisica', 'João Silva');
  await ensureAmbientePrincipal(userIdPF, 'fisica', 'João Silva');
  const { rows } = await query(
    `SELECT COUNT(*) AS n FROM ambientes_financeiros WHERE usuario_id = $1 AND ativo = true`,
    [userIdPF]
  );
  ok('não criou duplicado', rows[0]?.n === '1');
}

// ── 4. PJ → tipo empresa ──────────────────────────────────────────────────────
console.log('\n── 4. ensureAmbientePrincipal tipo empresa (PJ) ──');
const userIdPJ = await insertTestUser(emailPJ, 'juridica', 'Empresa Ltda');
{
  const amb = await ensureAmbientePrincipal(userIdPJ, 'juridica', 'Empresa Ltda');
  ok('tipo = empresa', amb?.tipo === 'empresa');
  ok('nome = Empresa Ltda', amb?.nome === 'Empresa Ltda');
}

// ── 5. listAmbientes ──────────────────────────────────────────────────────────
console.log('\n── 5. listAmbientes retorna lista ──');
{
  const list = await listAmbientes(userIdPF);
  ok('retornou array', Array.isArray(list));
  ok('1 ambiente na lista', list.length === 1);
  ok('id presente', !!list[0]?.id);
}

// ── 6. createAmbiente cria segundo ambiente ───────────────────────────────────
console.log('\n── 6. createAmbiente cria segundo ambiente ──');
{
  const novo = await createAmbiente(userIdPF, { nome: 'Empresa Secundária', tipo: 'empresa' });
  ok('retornou com id', !!novo?.id);
  ok('nome correto', novo?.nome === 'Empresa Secundária');
  const list = await listAmbientes(userIdPF);
  ok('agora tem 2 ambientes', list.length === 2);
}

// ── 7. GET /api/state injeta ambientes ───────────────────────────────────────
console.log('\n── 7. GET /api/state injeta dados.ambientes ──');
{
  const token = await login(emailPF);
  ok('login OK', !!token);
  if (token) {
    const { status, data } = await req('/state', { token });
    ok('GET /api/state 200', status === 200);
    ok('dados.ambientes é array', Array.isArray(data.dados?.ambientes));
    ok('dados.ambientes tem 2 itens', data.dados?.ambientes?.length === 2);
    ok('dados.ambienteAtualId presente', !!data.dados?.ambienteAtualId);
  } else {
    failed += 4; // pula sub-testes
  }
}

// ── 8. PUT /api/state strip dados.ambientes ───────────────────────────────────
console.log('\n── 8. PUT /api/state não persiste dados.ambientes ──');
{
  const token = await login(emailPF);
  if (token) {
    const { data: stateData } = await req('/state', { token });
    const dadosComAmbientes = stateData.dados; // inclui dados.ambientes (injetado)
    ok('dados.ambientes presente antes do PUT', Array.isArray(dadosComAmbientes?.ambientes));

    const { status } = await req('/state', {
      method: 'PUT', token,
      body: { dados: dadosComAmbientes },
    });
    ok('PUT /api/state 200', status === 200);

    // Verifica que não foi salvo no banco
    const { rows } = await query(
      `SELECT dados->'ambientes' AS amb FROM estados WHERE usuario_id = $1`,
      [userIdPF]
    );
    ok('ambientes não salvo no banco', rows[0]?.amb === null || rows[0]?.amb === undefined);
  } else {
    failed += 3;
  }
}

// ── 9. POST /api/ambientes/:id/selecionar ────────────────────────────────────
console.log('\n── 9. /api/ambientes/:id/selecionar persiste ambienteAtualId ──');
{
  const token = await login(emailPF);
  if (token) {
    const ambientes = await listAmbientes(userIdPF);
    const segundoId = ambientes.find((a) => a.nome === 'Empresa Secundária')?.id;
    ok('segundo ambiente encontrado', !!segundoId);
    if (segundoId) {
      const { status, data } = await req(`/ambientes/${segundoId}/selecionar`, {
        method: 'POST', token,
      });
      ok('selecionar retornou 200', status === 200);
      ok('ok = true', data.ok === true);
      ok('ambienteAtualId correto', data.ambienteAtualId === segundoId);

      const { rows } = await query(
        `SELECT dados->>'ambienteAtualId' AS aid FROM estados WHERE usuario_id = $1`,
        [userIdPF]
      );
      ok('ambienteAtualId salvo no banco', rows[0]?.aid === segundoId);
    } else {
      failed += 4;
    }
  } else {
    failed += 5;
  }
}

// ── 10. Cadastro cria ambiente automaticamente ───────────────────────────────
console.log('\n── 10. /api/auth/register cria ambiente automaticamente ──');
{
  const { status } = await req('/auth/register', {
    method: 'POST',
    body: {
      nome: 'Novo Usuario', email: emailNew, senha: PASS,
      tipo_perfil: 'juridica', nome_perfil: 'Nova Empresa SA',
    },
  });
  ok('register 201', status === 201);

  const { rows: uRows } = await query('SELECT id FROM usuarios WHERE email = $1', [emailNew]);
  const newId = uRows[0]?.id;
  ok('usuário criado', !!newId);
  if (newId) {
    const { rows: aRows } = await query(
      `SELECT nome, tipo FROM ambientes_financeiros WHERE usuario_id = $1 AND ativo = true`,
      [newId]
    );
    ok('ambiente criado no registro', aRows.length === 1);
    ok('tipo = empresa', aRows[0]?.tipo === 'empresa');
    ok('nome = Nova Empresa SA', aRows[0]?.nome === 'Nova Empresa SA');
  } else {
    failed += 3;
  }
}

// ─── Limpeza ──────────────────────────────────────────────────────────────────
await cleanupUser(emailPF);
await cleanupUser(emailPJ);
await cleanupUser(emailNew);
await pool.end();

console.log('\n' + '─'.repeat(52));
if (failed === 0) {
  console.log(`✅ Todos os ${passed} testes passaram!\n`);
} else {
  console.log(`❌ ${failed} falha(s) de ${passed + failed} testes\n`);
  process.exit(1);
}
