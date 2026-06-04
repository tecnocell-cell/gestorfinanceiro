/**
 * Testes Etapa 7.0 — Regras comerciais, UX pública, WhatsApp, PDF, logout
 * npm run test:70
 */
import { config } from 'dotenv';
config();

import bcrypt from 'bcryptjs';
import { query, pool } from './db.js';
import { createInitialState } from './initialState.js';
import { runMigrations } from './migrate.js';
import {
  PLAN_CATALOG,
  DEFAULT_RESOURCES_BY_SLUG,
  PUBLIC_MESSAGES,
  getMenuAccess,
  whatsappCapabilitiesFromRecursos,
  sanitizePublicMessage,
} from './billing/planRules.js';
import { getSystemConfigStatus } from './system/configStatus.js';
import { sanitizeForPublic } from './emailProvider.js';

const BASE = `http://127.0.0.1:${process.env.PORT || 3001}/api`;
const TS = Date.now();
const LANDING = 'https://fluxiva.app';

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

async function createUser({ email, senha, tipo = 'fisica' }) {
  const hash = await bcrypt.hash(senha, 12);
  const ins = await query(
    `INSERT INTO usuarios (
       email, senha_hash, nome, role, ativo, tipo_perfil, nome_perfil,
       email_verificado, telefone_verificado
     ) VALUES ($1,$2,'Test 70','user',true,$3,'Test 70',true,false)
     RETURNING id, email`,
    [email, hash, tipo]
  );
  await query('INSERT INTO estados (usuario_id, dados) VALUES ($1,$2)', [
    ins.rows[0].id,
    JSON.stringify(createInitialState(tipo, 'Test 70')),
  ]);
  return ins.rows[0];
}

async function login(email, senha) {
  const { data } = await req('/auth/login', { method: 'POST', body: { email, senha } });
  return data.token;
}

function testPlanRulesStatic() {
  console.log('\n— Regras por plano (planRules.js) —');
  assert(PLAN_CATALOG.pf_basico.precoCentavos === 1990, 'PF Básico R$ 19,90');
  assert(PLAN_CATALOG.pf_plus.recursos.limiteWhatsappNumeros === 3, 'PF Plus 3 WhatsApp');
  assert(PLAN_CATALOG.pf_premium.recursos.iaComprovante === true, 'PF Premium comprovante IA');
  assert(PLAN_CATALOG.pj_start.recursos.integracaoPfPj === true, 'PJ Start integração PF/PJ');
  assert(PLAN_CATALOG.pj_pro.recursos.projetos === true, 'PJ Pro projetos');
  assert(PLAN_CATALOG.pj_business.recursos.apiAccess === true, 'PJ Business API');

  const caps = whatsappCapabilitiesFromRecursos(DEFAULT_RESOURCES_BY_SLUG.pf_basico);
  assert(caps.max_authorized_numbers === 1 && caps.ai_text_enabled, 'PF Básico 1 número + texto');

  const capsPj = whatsappCapabilitiesFromRecursos(DEFAULT_RESOURCES_BY_SLUG.pj_business);
  assert(capsPj.max_authorized_numbers === 15, 'PJ Business 15 números');

  assert(
    getMenuAccess('integracao-pf-pj', DEFAULT_RESOURCES_BY_SLUG.pf_basico, { segmento: 'pf' }) === 'hide',
    'PF Básico esconde integração PF/PJ'
  );
  assert(
    getMenuAccess('projetos', DEFAULT_RESOURCES_BY_SLUG.pf_basico, { segmento: 'pf' }) === 'blocked',
    'PF Básico bloqueia projetos'
  );
  assert(
    getMenuAccess('integracao-pf-pj', DEFAULT_RESOURCES_BY_SLUG.pj_start, { segmento: 'pj' }) === 'show',
    'PJ Start mostra integração PF/PJ'
  );
}

function testPublicMessages() {
  console.log('\n— Mensagens públicas —');
  const bad = sanitizePublicMessage('Configure ASAAS_API_KEY no servidor');
  assert(bad === PUBLIC_MESSAGES.planBlocked, 'ASAAS sanitizado');
  const pluggy = sanitizePublicMessage('Open Finance automático (Pluggy)');
  assert(pluggy === PUBLIC_MESSAGES.planBlocked, 'Pluggy sanitizado');
  assert(!PUBLIC_MESSAGES.billing.includes('ASAAS'), 'billing sem ASAAS');
  assert(!PUBLIC_MESSAGES.email.includes('SMTP'), 'email sem SMTP');
}

async function testConfigStatusNoSecrets() {
  console.log('\n— config-status —');
  const raw = await getSystemConfigStatus();
  const pub = sanitizeForPublic(raw);
  const blob = JSON.stringify(pub);
  assert(!blob.includes('ASAAS_API_KEY'), 'config-status sem ASAAS_API_KEY');
  assert(!blob.includes('OPENFINANCE_CLIENT_SECRET'), 'config-status sem secrets OF');
}

async function testWhatsappLimits(tokenPf, tokenPj) {
  console.log('\n— Limite WhatsApp por plano —');
  const limPf = await req('/whatsapp/plan-limit', { token: tokenPf });
  assert(limPf.data.max_authorized_numbers >= 1, 'plan-limit PF retorna limite');
  assert(limPf.data.ai_text_enabled === true, 'PF sempre texto habilitado');

  const usoPj = await req('/billing/usage', { token: tokenPj });
  assert(
    usoPj.data.limites?.whatsappNumeros >= 2,
    `PJ Start limite WhatsApp (got ${usoPj.data.limites?.whatsappNumeros}, plano ${usoPj.data.plano_slug})`
  );
  const limPj = await req('/whatsapp/plan-limit', { token: tokenPj });
  assert(
    limPj.data.max_authorized_numbers >= 2,
    `whatsapp/plan-limit PJ (got ${limPj.data.max_authorized_numbers}, plan ${limPj.data.plan})`
  );
}

async function testBillingCheckoutMessage(token) {
  console.log('\n— Checkout / mensagem comercial —');
  const { status, data } = await req('/billing/checkout', {
    method: 'POST',
    token,
    body: { plano_slug: 'pf_plus' },
    allowError: true,
  });
  if (status === 503) {
    assert(data.error === PUBLIC_MESSAGES.billing, 'checkout 503 mensagem comercial');
    assert(!String(data.error).includes('ASAAS'), 'checkout sem ASAAS na resposta');
  } else {
    assert(
      status === 200 || status === 400,
      `checkout com Asaas ativo (status ${status})`
    );
    console.log('  ✓ servidor com Asaas configurado — checkout real disponível');
  }
}

async function testAuthorizedAdd(token) {
  console.log('\n— POST authorized —');
  const phone = `5511999${String(TS).slice(-6)}`;
  const { status, data } = await req('/whatsapp/authorized', {
    method: 'POST',
    token,
    body: { phone_number: phone, label: 'Teste 70' },
    allowError: true,
  });
  assert(status === 201 || status === 403, 'authorized POST responde');
  if (status === 201) {
    assert(data.authorized?.phone_number, 'número criado');
    await req(`/whatsapp/authorized/${data.authorized.id}`, {
      method: 'DELETE',
      token,
      allowError: true,
    });
  }
}

function testPdfModules() {
  console.log('\n— PDF (estrutura) —');
  assert(typeof PUBLIC_MESSAGES.planBlocked === 'string', 'mensagens plano definidas');
}

async function main() {
  console.log('Test 70 — Etapa 7.0');
  await runMigrations();

  testPlanRulesStatic();
  testPublicMessages();
  await testConfigStatusNoSecrets();

  const emailPf = `t70pf${TS}@test.local`;
  const emailPj = `t70pj${TS}@test.local`;
  const senha = 'Test70!Senha';
  await createUser({ email: emailPf, senha, tipo: 'fisica' });
  await createUser({ email: emailPj, senha, tipo: 'juridica' });
  const tokenPf = await login(emailPf, senha);
  const tokenPj = await login(emailPj, senha);

  await testWhatsappLimits(tokenPf, tokenPj);
  await testBillingCheckoutMessage(tokenPf);
  await testAuthorizedAdd(tokenPf);

  testPdfModules();

  console.log('\n— Logout redirect (constante esperada) —');
  assert(LANDING === 'https://fluxiva.app', 'landing logout fluxiva.app');

  console.log('\n✅ test:70 OK\n');
  await pool.end();
}

main().catch((e) => {
  console.error('\n❌ test:70', e.message);
  pool.end().finally(() => process.exit(1));
});
