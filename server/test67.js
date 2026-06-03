/**
 * Testes Etapa 6.7 — Multiusuário PJ e permissões
 * Uso: npm run test:67  (servidor: npm run server)
 */
import { config } from 'dotenv';
config();

import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { query, pool } from './db.js';
import { createInitialState } from './initialState.js';
import { runMigrations } from './migrate.js';
import { hasPermission } from './auth/permissions.js';

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
    if (!rows.length) continue;
    const id = rows[0].id;
    await query('DELETE FROM convites_empresa WHERE empresa_usuario_id = $1 OR email = $2', [
      id,
      email,
    ]).catch(() => {});
    await query(
      'DELETE FROM empresa_usuarios WHERE empresa_usuario_id = $1 OR membro_usuario_id = $1',
      [id]
    ).catch(() => {});
    await query('DELETE FROM empresa_usuarios WHERE membro_usuario_id = $1', [id]).catch(() => {});
    await query('DELETE FROM pagamentos WHERE usuario_id = $1', [id]).catch(() => {});
    await query('DELETE FROM faturas WHERE usuario_id = $1', [id]).catch(() => {});
    await query('DELETE FROM assinaturas WHERE usuario_id = $1', [id]);
    await query('DELETE FROM estados WHERE usuario_id = $1', [id]);
    await query('DELETE FROM usuarios WHERE id = $1', [id]);
  }
}

async function ensureAssinaturaPjStart(usuarioId) {
  const { rows: plan } = await query(`SELECT id FROM planos WHERE slug = 'pj_start'`);
  await query(
    `INSERT INTO assinaturas (usuario_id, plano_id, status, trial_ate)
     VALUES ($1, $2, 'ativa', NULL)
     ON CONFLICT (usuario_id) DO UPDATE SET plano_id = $2, status = 'ativa'`,
    [usuarioId, plan[0].id]
  );
}

async function main() {
  console.log('=== Testes Etapa 6.7 — Multiusuário PJ ===\n');
  await runMigrations();

  const emailOwner = `test_67_owner_${TS}@test.local`;
  const emailAdmin = `test_67_admin_${TS}@test.local`;
  const emailFin = `test_67_fin_${TS}@test.local`;
  const emailOp = `test_67_op_${TS}@test.local`;
  const emailLeitura = `test_67_leitura_${TS}@test.local`;
  const emailExtra = `test_67_extra_${TS}@test.local`;
  const pass = 'test123456';

  await cleanup([
    emailOwner,
    emailAdmin,
    emailFin,
    emailOp,
    emailLeitura,
    emailExtra,
  ]);

  const owner = await createUser({
    email: emailOwner,
    senha: pass,
    tipo: 'juridica',
    nomePerfil: 'PJ 67 Owner',
  });
  await ensureAssinaturaPjStart(owner.id);
  const tokenOwner = await login(emailOwner, pass);
  await req('/billing/assinatura', { token: tokenOwner });
  const { status: simSt } = await req('/billing/assinatura/simular', {
    token: tokenOwner,
    method: 'POST',
    body: { plano_slug: 'pj_business' },
    allowError: true,
  });
  assert(simSt === 200, 'owner upgrade pj_business para testes de equipe');

  console.log('--- Owner e perfil padrão ---');
  const { data: meOwner } = await req('/auth/me', { token: tokenOwner });
  assert(meOwner.empresa?.perfil === 'owner', 'owner: perfil owner no /auth/me');
  assert(meOwner.empresa?.isOwner === true, 'owner: isOwner');

  const { data: ctxOwner } = await req('/empresa/context', { token: tokenOwner });
  assert(ctxOwner.perfil === 'owner', 'owner context');

  console.log('\n--- Permissões por perfil (helper) ---');
  assert(await hasPermission(owner.id, 'billing.view'), 'owner billing.view');
  assert(await hasPermission(owner.id, 'equipe.manage'), 'owner equipe.manage');

  const uAdmin = await createUser({
    email: emailAdmin,
    senha: pass,
    tipo: 'juridica',
    nomePerfil: 'Membro Admin',
  });
  const uFin = await createUser({
    email: emailFin,
    senha: pass,
    tipo: 'juridica',
    nomePerfil: 'Membro Fin',
  });
  const uOp = await createUser({
    email: emailOp,
    senha: pass,
    tipo: 'juridica',
    nomePerfil: 'Membro Op',
  });
  const uLeitura = await createUser({
    email: emailLeitura,
    senha: pass,
    tipo: 'juridica',
    nomePerfil: 'Membro Leitura',
  });

  async function convidarEAceitar(email, perfil) {
    const { data: conv } = await req('/empresa/convidar', {
      token: tokenOwner,
      method: 'POST',
      body: { email, perfil },
    });
    const tokenConvite = conv.dev_token;
    assert(!!tokenConvite, `convite ${perfil} com dev_token`);
    const { rows } = await query('SELECT id FROM usuarios WHERE email = $1', [email.toLowerCase()]);
    const tokenMembro = await login(email, pass);
    await req('/empresa/aceitar-convite', {
      token: tokenMembro,
      method: 'POST',
      body: { token: tokenConvite },
    });
    return tokenMembro;
  }

  console.log('\n--- Convite e aceite ---');
  const tokenAdmin = await convidarEAceitar(emailAdmin, 'admin');
  const tokenFin = await convidarEAceitar(emailFin, 'financeiro');
  const tokenOp = await convidarEAceitar(emailOp, 'operador');
  const tokenLeitura = await convidarEAceitar(emailLeitura, 'leitura');

  const { data: membros } = await req('/empresa/membros', { token: tokenOwner });
  assert(membros.membros?.length >= 5, 'lista membros inclui owner + 4');

  console.log('\n--- Proteção backend por perfil ---');
  const { status: billAdmin } = await req('/billing/usage', {
    token: tokenAdmin,
    allowError: true,
  });
  assert(billAdmin === 403, 'admin sem billing.view (usage 403)');

  const { status: equipeFin } = await req('/empresa/membros', {
    token: tokenFin,
    allowError: true,
  });
  assert(equipeFin === 403, 'financeiro sem equipe.view');

  const { status: equipeOp } = await req('/empresa/membros', {
    token: tokenOp,
    allowError: true,
  });
  assert(equipeOp === 403, 'operador sem equipe.view');

  const { data: meLeitura } = await req('/auth/me', { token: tokenLeitura });
  assert(meLeitura.empresa?.viewOnly === true, 'leitura viewOnly no me');
  assert(!(await hasPermission(uLeitura.id, 'state.write')), 'leitura sem state.write');

  const { status: putLeitura } = await req('/state', {
    token: tokenLeitura,
    method: 'PUT',
    body: { dados: createInitialState('juridica', 'X') },
    allowError: true,
  });
  assert(putLeitura === 403, 'leitura PUT state bloqueado');

  const { status: getLeitura } = await req('/state', { token: tokenLeitura });
  assert(getLeitura === 200, 'leitura GET state permitido');

  console.log('\n--- Membro acessa estado da empresa (owner) ---');
  const { data: stOwner } = await req('/state', { token: tokenOwner });
  const { data: stOp } = await req('/state', { token: tokenOp });
  assert(
    stOp.dados?.empresaAtivaId === stOwner.dados?.empresaAtivaId,
    'operador vê mesmo estado do owner'
  );

  console.log('\n--- Limite de usuários (pj_start = 3) ---');
  const { rows: planStart } = await query(`SELECT id FROM planos WHERE slug = 'pj_start'`);
  await query(`UPDATE assinaturas SET plano_id = $1, status = 'ativa' WHERE usuario_id = $2`, [
    planStart[0].id,
    owner.id,
  ]);
  await query(
    `DELETE FROM empresa_usuarios WHERE empresa_usuario_id = $1 AND membro_usuario_id != $1`,
    [owner.id]
  );
  await query('DELETE FROM convites_empresa WHERE empresa_usuario_id = $1', [owner.id]);

  const emailM2 = `test_67_m2_${TS}@test.local`;
  const emailM3 = `test_67_m3_${TS}@test.local`;
  await cleanup([emailM2, emailM3]);
  await createUser({ email: emailM2, senha: pass, tipo: 'juridica', nomePerfil: 'M2' });
  await createUser({ email: emailM3, senha: pass, tipo: 'juridica', nomePerfil: 'M3' });

  await convidarEAceitar(emailM2, 'leitura');
  await convidarEAceitar(emailM3, 'leitura');

  const { status: conv4, data: conv4data } = await req('/empresa/convidar', {
    token: tokenOwner,
    method: 'POST',
    body: { email: emailExtra, perfil: 'leitura' },
    allowError: true,
  });
  assert(conv4 === 403 || conv4data.code === 'PLAN_LIMIT', '4º convite bloqueado por limite');

  const { data: usage } = await req('/billing/usage', { token: tokenOwner });
  assert(usage.uso?.usuarios?.usados >= 3, 'usage usuarios usados >= 3');
  assert(usage.uso?.usuarios?.limite === 3, 'usage usuarios limite pj_start 3');

  console.log('\n--- Usage expõe usuarios { usados, limite } ---');
  assert(
    typeof usage.uso.usuarios === 'object' && usage.uso.usuarios.usados != null,
    'usuarios nested no usage'
  );

  await cleanup([
    emailOwner,
    emailAdmin,
    emailFin,
    emailOp,
    emailLeitura,
    emailExtra,
    emailM2,
    emailM3,
  ]);

  console.log('\n=== Todos os testes 6.7 passaram ===\n');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  pool.end().finally(() => process.exit(1));
});
