/**
 * Testa fluxos de cadastro:
 *   1. Plano escolhido na landing chega correto na assinatura
 *   2. WhatsApp via lead flow (source=whatsapp) salva número autorizado
 */
import { config } from 'dotenv';
config();

import bcrypt from 'bcryptjs';
import { query, pool } from './db.js';
import { runMigrations } from './migrate.js';
import { ensureAssinaturaPadrao } from './billing/subscriptions.js';

const BASE = 'http://localhost:3001';
const TS   = Date.now();
const PASS = 'Teste123!';
let passed = 0, failed = 0;

function ok(label, val) {
  if (val) { console.log(`  ✓ ${label}`); passed++; }
  else     { console.error(`  ✗ ${label}`); failed++; }
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

async function register(payload) {
  return req('/auth/register', { method: 'POST', body: payload });
}

async function cleanup(emails) {
  for (const email of emails) {
    const { rows } = await query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (!rows.length) continue;
    const id = rows[0].id;
    await query('DELETE FROM whatsapp_authorized_numbers WHERE usuario_id = $1', [id]);
    await query('DELETE FROM assinaturas WHERE usuario_id = $1', [id]);
    await query('DELETE FROM estados WHERE usuario_id = $1', [id]);
    await query('DELETE FROM usuarios WHERE id = $1', [id]);
  }
}

// ─── emails dos testes ───────────────────────────────────────────────────────
const emailPfPlus    = `test_plan_pf_plus_${TS}@test.local`;
const emailPjBiz     = `test_plan_pj_biz_${TS}@test.local`;
const emailWa        = `test_wa_source_${TS}@test.local`;
const emailWaConflict = `test_wa_conflict_${TS}@test.local`;
const emailPfDefault = `test_plan_default_${TS}@test.local`;

await runMigrations();
await cleanup([emailPfPlus, emailPjBiz, emailWa, emailWaConflict, emailPfDefault]);

console.log('\n=== TESTES: Cadastro com plano + WhatsApp autorizado ===\n');

// ── 1. Cadastro PF escolhendo pf_plus ───────────────────────────────────────
console.log('── Flow 1a: PF com plano pf_plus ──');
{
  const { status, data } = await register({
    nome: 'Maria Plus', email: emailPfPlus, senha: PASS,
    tipo_perfil: 'fisica', nome_perfil: 'Maria Plus',
    plano_slug: 'pf_plus',
  });
  ok('register 201', status === 201);
  ok('ok true', data.ok === true);

  const { rows: userRows } = await query('SELECT id FROM usuarios WHERE email = $1', [emailPfPlus]);
  const userId = userRows[0]?.id;
  ok('usuario criado', !!userId);

  const { rows: assRows } = await query(
    `SELECT p.slug FROM assinaturas a JOIN planos p ON p.id = a.plano_id WHERE a.usuario_id = $1`,
    [userId]
  );
  ok('assinatura criada', assRows.length > 0);
  ok('plano = pf_plus', assRows[0]?.slug === 'pf_plus');
}

// ── 2. Cadastro PJ escolhendo pj_business ───────────────────────────────────
console.log('\n── Flow 1b: PJ com plano pj_business ──');
{
  const { status, data } = await register({
    nome: 'Empresa Biz', email: emailPjBiz, senha: PASS,
    tipo_perfil: 'juridica', nome_perfil: 'Empresa Biz Ltda',
    plano_slug: 'pj_business',
  });
  ok('register 201', status === 201);

  const { rows: userRows } = await query('SELECT id FROM usuarios WHERE email = $1', [emailPjBiz]);
  const userId = userRows[0]?.id;

  const { rows: assRows } = await query(
    `SELECT p.slug FROM assinaturas a JOIN planos p ON p.id = a.plano_id WHERE a.usuario_id = $1`,
    [userId]
  );
  ok('plano = pj_business', assRows[0]?.slug === 'pj_business');
}

// ── 3. Cadastro sem plano → fallback para padrão ─────────────────────────────
console.log('\n── Flow 1c: PF sem plano_slug → pf_basico ──');
{
  const { status } = await register({
    nome: 'João Default', email: emailPfDefault, senha: PASS,
    tipo_perfil: 'fisica', nome_perfil: 'João Default',
    // sem plano_slug
  });
  ok('register 201', status === 201);

  const { rows: userRows } = await query('SELECT id FROM usuarios WHERE email = $1', [emailPfDefault]);
  const userId = userRows[0]?.id;

  const { rows: assRows } = await query(
    `SELECT p.slug FROM assinaturas a JOIN planos p ON p.id = a.plano_id WHERE a.usuario_id = $1`,
    [userId]
  );
  ok('plano = pf_basico (fallback)', assRows[0]?.slug === 'pf_basico');
}

// ── 4. Cadastro PF tentando plano PJ → fallback ───────────────────────────────
console.log('\n── Flow 1d: PF com plano PJ → fallback pf_basico ──');
{
  const emailCross = `test_plan_cross_${TS}@test.local`;
  await cleanup([emailCross]);
  const { status } = await register({
    nome: 'Cross Test', email: emailCross, senha: PASS,
    tipo_perfil: 'fisica', nome_perfil: 'Cross Test',
    plano_slug: 'pj_pro',  // plano PJ para usuário PF
  });
  ok('register 201', status === 201);

  const { rows: userRows } = await query('SELECT id FROM usuarios WHERE email = $1', [emailCross]);
  const userId = userRows[0]?.id;

  const { rows: assRows } = await query(
    `SELECT p.slug FROM assinaturas a JOIN planos p ON p.id = a.plano_id WHERE a.usuario_id = $1`,
    [userId]
  );
  ok('plano = pf_basico (cross-segment fallback)', assRows[0]?.slug === 'pf_basico');
  await cleanup([emailCross]);
}

// ── 5. Cadastro via WhatsApp (source=whatsapp) ───────────────────────────────
console.log('\n── Flow 2a: Cadastro via WhatsApp ──');
const waPhone = `5511999${TS.toString().slice(-6)}`;
{
  const { status, data } = await register({
    nome: 'Ana WhatsApp', email: emailWa, senha: PASS,
    tipo_perfil: 'fisica', nome_perfil: 'Ana WA',
    telefone: waPhone,
    whatsapp_phone: waPhone,
    whatsapp_source: 'whatsapp',
    plano_slug: 'pf_plus',
  });
  ok('register 201', status === 201);
  ok('ok true', data.ok === true);

  const { rows: userRows } = await query('SELECT id FROM usuarios WHERE email = $1', [emailWa]);
  const userId = userRows[0]?.id;
  ok('usuario criado', !!userId);

  const { rows: waRows } = await query(
    `SELECT phone_number, is_primary, active FROM whatsapp_authorized_numbers WHERE usuario_id = $1`,
    [userId]
  );
  ok('número autorizado salvo', waRows.length > 0);
  ok('número correto', waRows[0]?.phone_number === waPhone);
  ok('is_primary = true', waRows[0]?.is_primary === true);
  ok('active = true', waRows[0]?.active === true);

  // plano também foi salvo
  const { rows: assRows } = await query(
    `SELECT p.slug FROM assinaturas a JOIN planos p ON p.id = a.plano_id WHERE a.usuario_id = $1`,
    [userId]
  );
  ok('plano = pf_plus via WhatsApp', assRows[0]?.slug === 'pf_plus');
}

// ── 6. Conflito: mesmo número em outra conta ─────────────────────────────────
console.log('\n── Flow 2b: Conflito de número WhatsApp ──');
{
  const { status, data } = await register({
    nome: 'Conflito WA', email: emailWaConflict, senha: PASS,
    tipo_perfil: 'fisica', nome_perfil: 'Conflito',
    telefone: waPhone,
    whatsapp_phone: waPhone,      // mesmo número já cadastrado
    whatsapp_source: 'whatsapp',
  });
  ok('register retorna 409', status === 409);
  ok('code WHATSAPP_PHONE_CONFLICT', data.code === 'WHATSAPP_PHONE_CONFLICT');

  // usuário não deve ter sido criado (rollback)
  const { rows } = await query('SELECT id FROM usuarios WHERE email = $1', [emailWaConflict]);
  ok('usuário não criado (rollback)', rows.length === 0);
}

// ── Limpeza ──────────────────────────────────────────────────────────────────
await cleanup([emailPfPlus, emailPjBiz, emailWa, emailWaConflict, emailPfDefault]);
await pool.end();

console.log('\n' + '─'.repeat(52));
if (failed === 0) {
  console.log(`✅ Todos os ${passed} testes passaram!\n`);
} else {
  console.log(`❌ ${failed} falha(s) de ${passed + failed} testes\n`);
  process.exit(1);
}
