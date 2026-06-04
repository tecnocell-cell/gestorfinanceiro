/**
 * Testes Etapa 7.2 — Receita real, beta fechado
 * npm run test:72
 */
import { config } from 'dotenv';
config();

import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query, pool } from './db.js';
import { createInitialState } from './initialState.js';
import { runMigrations } from './migrate.js';
import { getPublicPlanCatalog } from './billing/planCatalogExport.js';
import { PLAN_CATALOG } from './billing/planRules.js';
import { isAsaasRealKeyConfigured } from './billing/gateways/asaas.js';

process.env.BILLING_USE_MOCK_GATEWAY = 'true';

const BASE = `http://127.0.0.1:${process.env.PORT || 3001}/api`;
const TS = Date.now();
const __dir = dirname(fileURLToPath(import.meta.url));

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

async function createUser({ email, senha, tipo, role = 'user' }) {
  const hash = await bcrypt.hash(senha, 12);
  const ins = await query(
    `INSERT INTO usuarios (email, senha_hash, nome, role, ativo, tipo_perfil, nome_perfil, email_verificado)
     VALUES ($1,$2,'T72',$3,true,$4,'T72',true) RETURNING id`,
    [email, hash, role, tipo]
  );
  await query('INSERT INTO estados (usuario_id, dados) VALUES ($1,$2)', [
    ins.rows[0].id,
    JSON.stringify(createInitialState(tipo, 'T72')),
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
    await query('DELETE FROM support_tickets WHERE usuario_id = $1', [id]).catch(() => {});
    await query('DELETE FROM estados WHERE usuario_id = $1', [id]);
    await query('DELETE FROM usuarios WHERE id = $1', [id]);
  }
}

function testTourInitialState() {
  console.log('\n— Tour (tourConcluido) —');
  const pf = createInitialState('fisica', 'T');
  assert(pf.empresas[0].tourConcluido === false, 'PF tour não concluído');
}

function testLandingCatalogSync() {
  console.log('\n— Landing alinhada ao catálogo —');
  const api = getPublicPlanCatalog();
  for (const slug of Object.keys(PLAN_CATALOG)) {
    const server = PLAN_CATALOG[slug];
    const row = api.find((p) => p.slug === slug);
    assert(row, `catalog API ${slug}`);
    assert(row.precoCentavos === server.precoCentavos, `${slug} preço centavos`);
  }
  const landingSrc = readFileSync(
    join(__dir, '../centerflow-frontend/src/data/planCatalog.ts'),
    'utf8'
  );
  for (const slug of Object.keys(PLAN_CATALOG)) {
    assert(landingSrc.includes(`"${slug}"`), `landing planCatalog ${slug}`);
    assert(
      landingSrc.includes(String(PLAN_CATALOG[slug].precoCentavos)),
      `landing preço ${slug}`
    );
  }
}

function testHelpContent() {
  console.log('\n— Central de Ajuda —');
  const pf = readFileSync(join(__dir, '../src/gestor/helpContent.js'), 'utf8');
  assert(pf.includes('HELP_PF'), 'help PF');
  assert(pf.includes('primeiro-lancamento'), 'ajuda PF lançamento');
  const pj = readFileSync(join(__dir, '../src/gestor/helpContent.js'), 'utf8');
  assert(pj.includes('HELP_PJ'), 'help PJ');
}

async function testBillingHealth(adminToken, userToken) {
  console.log('\n— billing-health (admin) —');
  const { data } = await req('/admin/billing-health', { token: adminToken });
  assert(typeof data.configured === 'boolean', 'configured');
  assert(data.environment, 'environment');
  assert(typeof data.webhookConfigured === 'boolean', 'webhookConfigured');
  assert(typeof data.activeSubscriptions === 'number', 'activeSubscriptions');
  assert(typeof data.pendingInvoices === 'number', 'pendingInvoices');
  const blob = JSON.stringify(data);
  assert(!blob.includes('ASAAS_API_KEY'), 'sem secret');

  const denied = await req('/admin/billing-health', { token: userToken, allowError: true });
  assert(denied.status === 403, 'usuário 403');
}

async function testFaturasPortal(tokenPf) {
  console.log('\n— Portal faturas (campos) —');
  const { data: checkout } = await req('/billing/checkout', {
    token: tokenPf,
    method: 'POST',
    body: { plano_slug: 'pf_plus' },
  });
  assert(checkout.ok, 'checkout mock');
  const { data: fat } = await req('/billing/faturas', { token: tokenPf });
  const f = fat.faturas?.[0];
  assert(f?.valor_centavos != null, 'fatura valor');
  assert(f?.vencimento, 'fatura vencimento');
  assert(f?.display_status != null || f?.status, 'fatura status');
}

async function testSupport(token) {
  console.log('\n— Suporte API —');
  const { data: created } = await req('/support/tickets', {
    token,
    method: 'POST',
    body: {
      categoria: 'assinatura',
      assunto: 'Teste 72',
      descricao: 'Chamado de teste etapa 7.2',
    },
  });
  assert(created.ticket?.id, 'ticket criado');
  const { data: list } = await req('/support/tickets', { token });
  assert(list.tickets?.length >= 1, 'lista tickets');
  await req(`/support/tickets/${created.ticket.id}`, {
    token,
    method: 'PATCH',
    body: { status: 'em_andamento' },
  });
}

async function testAdminOverview(adminToken) {
  console.log('\n— Admin SaaS expandido —');
  const { data } = await req('/admin/overview', { token: adminToken });
  assert(data.usuarios?.novos_7d != null, 'novos 7d');
  assert(data.usuarios?.ativos_30d != null, 'ativos 30d');
  assert(data.planos?.pf_ativos != null, 'planos PF');
  assert(data.suporte?.tickets_abertos != null, 'tickets abertos');
  assert(!JSON.stringify(data).includes('lancamentos'), 'sem lançamentos clientes');
}

async function testOnboardingPersist(tokenPf) {
  const dados = (await req('/state', { token: tokenPf })).data.dados;
  dados.empresas[0].tourConcluido = true;
  await req('/state', { token: tokenPf, method: 'PUT', body: { dados } });
  const back = (await req('/state', { token: tokenPf })).data.dados;
  assert(back.empresas[0].tourConcluido === true, 'tour persistido');
}

async function main() {
  console.log('=== Testes Etapa 7.2 ===\n');
  await runMigrations();

  testTourInitialState();
  testLandingCatalogSync();
  testHelpContent();

  const emailAdmin = `test_72_admin_${TS}@test.local`;
  const emailPf = `test_72_pf_${TS}@test.local`;
  const pass = 'test123456';
  await cleanup([emailAdmin, emailPf]);

  await createUser({ email: emailAdmin, senha: pass, tipo: 'juridica', role: 'admin' });
  await createUser({ email: emailPf, senha: pass, tipo: 'fisica' });
  const tokenAdmin = await login(emailAdmin, pass);
  const tokenPf = await login(emailPf, pass);

  await testBillingHealth(tokenAdmin, tokenPf);
  await testFaturasPortal(tokenPf);
  await testSupport(tokenPf);
  await testAdminOverview(tokenAdmin);
  await testOnboardingPersist(tokenPf);

  console.log('\n— test:asaas disponível —');
  console.log(
    isAsaasRealKeyConfigured()
      ? '  (rode npm run test:asaas com ASAAS_ENV=sandbox)'
      : '  SKIP: sem ASAAS_API_KEY real'
  );

  await cleanup([emailAdmin, emailPf]);
  console.log('\n✅ test:72 OK\n');
  await pool.end();
}

main().catch((e) => {
  console.error('\n❌ test:72', e.message);
  pool.end().finally(() => process.exit(1));
});
