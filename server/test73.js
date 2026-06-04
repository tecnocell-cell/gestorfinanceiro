/**
 * Testes Etapa 7.3 — Gestão comercial SaaS (admin)
 * npm run test:73
 */
import { config } from 'dotenv';
config();

import bcrypt from 'bcryptjs';
import { query, pool } from './db.js';
import { createInitialState } from './initialState.js';
import { runMigrations } from './migrate.js';
import { ensureAssinaturaPadrao } from './billing/subscriptions.js';

process.env.BILLING_USE_MOCK_GATEWAY = 'true';

const BASE = `http://127.0.0.1:${process.env.PORT || 3001}/api`;
const TS = Date.now();

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
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

async function createUser({ email, senha, tipo }) {
  const hash = await bcrypt.hash(senha, 12);
  const ins = await query(
    `INSERT INTO usuarios (email, senha_hash, nome, role, ativo, tipo_perfil, nome_perfil, email_verificado, telefone)
     VALUES ($1,$2,'T73 User',$3,true,$4,'Empresa 73',true,'11999990073') RETURNING id`,
    [email, hash, 'user', tipo]
  );
  await query('INSERT INTO estados (usuario_id, dados) VALUES ($1,$2)', [
    ins.rows[0].id,
    JSON.stringify(createInitialState(tipo, 'Empresa 73')),
  ]);
  await ensureAssinaturaPadrao(ins.rows[0].id);
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
    await query('DELETE FROM admin_saas_auditoria WHERE alvo_usuario_id = $1 OR admin_usuario_id = $1', [id]).catch(() => {});
    await query('DELETE FROM faturas WHERE usuario_id = $1', [id]).catch(() => {});
    await query('DELETE FROM pagamentos WHERE usuario_id = $1', [id]).catch(() => {});
    await query('DELETE FROM assinaturas WHERE usuario_id = $1', [id]).catch(() => {});
    await query('DELETE FROM estados WHERE usuario_id = $1', [id]);
    await query('DELETE FROM usuarios WHERE id = $1', [id]);
  }
}

async function main() {
  console.log('=== Testes Etapa 7.3 ===\n');
  await runMigrations();

  const adminEmail = `admin_73_${TS}@test.local`;
  const pfEmail = `pf_73_${TS}@test.local`;
  const pjEmail = `pj_73_${TS}@test.local`;
  const pass = 'senha123';

  const adminHash = await bcrypt.hash(pass, 12);
  await query(
    `INSERT INTO usuarios (email, senha_hash, nome, role, ativo, tipo_perfil, nome_perfil, email_verificado)
     VALUES ($1,$2,'Admin 73','admin',true,'juridica','Admin',true)`,
    [adminEmail, adminHash]
  );
  await createUser({ email: pfEmail, senha: pass, tipo: 'fisica' });
  await createUser({ email: pjEmail, senha: pass, tipo: 'juridica' });

  const adminToken = await login(adminEmail, pass);
  const userToken = await login(pfEmail, pass);

  console.log('\n— config-status alertas —');
  const { data: cfg } = await req('/system/config-status');
  assert(Array.isArray(cfg.alerts), 'alertas no config-status');
  assert(cfg.alerts.every((a) => a.message && !String(a.message).includes('ASAAS_API_KEY')), 'alertas sem segredo');

  console.log('\n— listagem clientes —');
  const { data: list } = await req('/admin/clientes', { token: adminToken });
  assert(Array.isArray(list.clientes), 'clientes array');
  const pf = list.clientes.find((c) => c.email === pfEmail);
  assert(pf?.plano_slug, 'cliente com plano_slug');
  assert(pf?.assinatura_status, 'cliente com assinatura_status');
  assert(typeof pf.dias_para_vencimento === 'number' || pf.dias_para_vencimento === null, 'dias_para_vencimento');

  console.log('\n— filtros —');
  const { data: fTrial } = await req('/admin/clientes?filtro=trial', { token: adminToken });
  assert(fTrial.clientes.some((c) => c.assinatura_status === 'trial'), 'filtro trial');
  const { data: fPf } = await req('/admin/clientes?filtro=pf', { token: adminToken });
  assert(fPf.clientes.every((c) => c.tipo_perfil === 'fisica'), 'filtro pf');

  console.log('\n— busca telefone —');
  const { data: fBusca } = await req('/admin/clientes?q=11999990073', { token: adminToken });
  assert(fBusca.clientes.some((c) => c.email === pfEmail), 'busca por telefone');

  console.log('\n— alteração de plano + auditoria —');
  const { data: chg } = await req(`/admin/clientes/${pf.id}/plano`, {
    token: adminToken,
    method: 'POST',
    body: { plano_slug: 'pf_plus' },
  });
  assert(chg.ok !== false, 'alterar plano ok');
  assert(chg.assinatura?.plano?.slug === 'pf_plus', 'plano pf_plus aplicado');

  const { rows: aud } = await query(
    `SELECT acao, detalhes FROM admin_saas_auditoria WHERE alvo_usuario_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [pf.id]
  );
  assert(aud[0]?.acao === 'alterar_plano', 'auditoria alterar_plano');
  assert(aud[0]?.detalhes?.plano_novo === 'pf_plus', 'auditoria plano_novo');

  const badPlan = await req(`/admin/clientes/${pf.id}/plano`, {
    token: adminToken,
    method: 'POST',
    body: { plano_slug: 'pj_pro' },
    allowError: true,
  });
  assert(badPlan.status === 400, 'plano PJ rejeitado para PF');

  console.log('\n— detalhe cliente —');
  const { data: det } = await req(`/admin/clientes/${pf.id}`, { token: adminToken });
  assert(det.cliente?.email === pfEmail, 'detalhe email');
  assert(det.assinatura?.plano?.slug === 'pf_plus', 'detalhe plano');
  assert(Array.isArray(det.faturas), 'detalhe faturas');
  assert(Array.isArray(det.whatsapps), 'detalhe whatsapps');
  assert(!JSON.stringify(det).includes('lancamentos'), 'sem lançamentos no detalhe');

  console.log('\n— cobrança alertas —');
  const { data: cob } = await req('/admin/cobranca-alertas', { token: adminToken });
  assert(typeof cob.trials_terminando_7d === 'number', 'trials_terminando_7d');
  assert(Array.isArray(cob.avisos), 'avisos cobrança');

  console.log('\n— métricas SaaS (MRR) —');
  const { data: met } = await req('/admin/saas-metrics', { token: adminToken });
  assert(typeof met.mrr_centavos === 'number', 'mrr_centavos');
  assert(met.arr_centavos === met.mrr_centavos * 12, 'arr = mrr * 12');
  assert(met.mrr_formatado, 'mrr_formatado');

  console.log('\n— acesso negado usuário —');
  const denied = await req('/admin/clientes', { token: userToken, allowError: true });
  assert(denied.status === 403, 'usuário 403 admin clientes');

  await cleanup([adminEmail, pfEmail, pjEmail]);
  await pool.end();
  console.log('\n✅ test:73 OK\n');
}

main().catch(async (e) => {
  console.error('\n❌', e.message);
  await pool.end().catch(() => {});
  process.exit(1);
});
