/**
 * Testes Etapa 7.1 — Go-live comercial, onboarding, portal, convite, admin
 * npm run test:71  (servidor em execução ou sobe via spawn — usa API local)
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
import {
  PUBLIC_MESSAGES,
  sanitizePublicMessage,
  PLAN_CATALOG,
} from './billing/planRules.js';
import { mergeRecursos } from './billing/planResources.js';
import { previewConvite } from './empresa/empresaService.js';
import { paymentExternalRef } from './billing/gateways/asaas.js';

process.env.BILLING_USE_MOCK_GATEWAY = 'true';
delete process.env.ASAAS_API_KEY;

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

async function createUser({ email, senha, tipo, nomePerfil, role = 'user' }) {
  const hash = await bcrypt.hash(senha, 12);
  const ins = await query(
    `INSERT INTO usuarios (
       email, senha_hash, nome, role, ativo, tipo_perfil, nome_perfil, email_verificado
     ) VALUES ($1,$2,$3,$4,true,$5,$6,true) RETURNING id`,
    [email, hash, nomePerfil, role, tipo, nomePerfil]
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
    await query('DELETE FROM convites_empresa WHERE empresa_usuario_id = $1 OR email LIKE $2', [
      id,
      `%${TS}%`,
    ]).catch(() => {});
    await query('DELETE FROM eventos_pagamento WHERE payload::text LIKE $1', [`%${id}%`]).catch(
      () => {}
    );
    await query('DELETE FROM pagamentos WHERE usuario_id = $1', [id]);
    await query('DELETE FROM faturas WHERE usuario_id = $1', [id]);
    await query('DELETE FROM assinaturas WHERE usuario_id = $1', [id]);
    await query('DELETE FROM estados WHERE usuario_id = $1', [id]);
    await query('DELETE FROM usuarios WHERE id = $1', [id]);
  }
}

function testOnboardingInitialState() {
  console.log('\n— Onboarding no estado inicial —');
  const pf = createInitialState('fisica', 'PF 71');
  const pj = createInitialState('juridica', 'PJ 71');
  const empPf = pf.empresas[0];
  const empPj = pj.empresas[0];
  assert(empPf.onboardingConcluido === false, 'PF onboarding não concluído');
  assert(empPf.onboardingEtapa === 'pf-1', 'PF etapa pf-1');
  assert(empPj.onboardingConcluido === false, 'PJ onboarding não concluído');
  assert(empPj.onboardingEtapa === 'pj-1', 'PJ etapa pj-1');
}

function testPublicMessages71() {
  console.log('\n— Mensagens comerciais 7.1 —');
  assert(
    PUBLIC_MESSAGES.billing.includes('Contratação online em ativação'),
    'billing comercial'
  );
  assert(!PUBLIC_MESSAGES.billing.includes('ASAAS'), 'billing sem ASAAS');
  const bad = sanitizePublicMessage('Configure ASAAS_API_KEY');
  assert(bad === PUBLIC_MESSAGES.planBlocked, 'sanitiza ASAAS_API_KEY');
}

function testPdfExportSource() {
  console.log('\n— PDF export (metadados no fonte) —');
  const src = readFileSync(join(__dir, '../src/gestor/export/pdfExport.js'), 'utf8');
  assert(src.includes('Fluxiva'), 'PDF marca Fluxiva');
  assert(src.includes('buildPdfMeta'), 'buildPdfMeta exportado');
  assert(src.includes('Página'), 'rodapé paginação');
  assert(src.includes('Gerado em'), 'data de geração');
}

function testCommercialPlanIgnoresDbLimit() {
  console.log('\n— Plano comercial ignora limiteLancamentos do DB —');
  const merged = mergeRecursos('pf_basico', { limiteLancamentos: 2 });
  assert(merged.limiteLancamentos === null, 'pf_basico catálogo sem limite 2 do DB');
  assert(PLAN_CATALOG.pf_basico, 'pf_basico no catálogo');
}

async function testConviteInfo() {
  console.log('\n— Convite por link (preview público) —');
  const ownerEmail = `test_71_owner_${TS}@test.local`;
  const inviteeEmail = `test_71_inv_${TS}@test.local`;
  await cleanup([ownerEmail, inviteeEmail]);

  const owner = await createUser({
    email: ownerEmail,
    senha: 'test123456',
    tipo: 'juridica',
    nomePerfil: 'Empresa 71',
  });
  const tokenOwner = await login(ownerEmail, 'test123456');
  const { data: conv } = await req('/empresa/convidar', {
    token: tokenOwner,
    method: 'POST',
    body: { email: inviteeEmail, perfil: 'operador' },
  });
  const manual = conv.manual_token || conv.dev_token;
  assert(manual, 'token de convite gerado');

  const { data: info } = await req(`/empresa/convite-info?token=${encodeURIComponent(manual)}`);
  assert(info.convite?.empresaNome, 'convite-info empresa');
  assert(info.convite?.perfil === 'operador', 'convite-info perfil');
  assert(info.convite?.valid === true, 'convite válido');

  const preview = await previewConvite(manual);
  assert(preview.empresaNome, 'previewConvite empresa');
  assert(preview.valid, 'preview válido');
}

async function testAdminOverview(adminToken, userToken) {
  console.log('\n— Admin overview (sem dados financeiros) —');
  const { status, data } = await req('/admin/overview', { token: adminToken });
  assert(status === 200, 'overview 200');
  assert(typeof data.usuarios?.total === 'number', 'total usuários');
  assert(typeof data.assinaturas?.ativas === 'number', 'assinaturas ativas');
  assert(data.mrr_estimado_centavos != null, 'MRR presente');
  const blob = JSON.stringify(data);
  assert(!blob.includes('lancamentos'), 'sem lançamentos');
  assert(!blob.includes('estados'), 'sem estados');
  assert(!blob.includes('saldo'), 'sem saldo');

  const denied = await req('/admin/overview', { token: userToken, allowError: true });
  assert(denied.status === 403, 'usuário comum 403');
}

async function testWhatsappLimit(tokenPf) {
  console.log('\n— Limite WhatsApp —');
  const { data: lim } = await req('/whatsapp/plan-limit', { token: tokenPf });
  assert(lim.max_authorized_numbers >= 1, 'limite máximo definido');
  const { status } = await req('/whatsapp/authorized', {
    token: tokenPf,
    method: 'POST',
    body: { phone_number: `5511999${String(TS).slice(-6)}`, label: 'T71' },
    allowError: true,
  });
  assert(status === 201 || status === 200 || status === 403, 'add número responde');
}

async function testBillingMockCheckout(tokenPf) {
  console.log('\n— Checkout mock + webhook idempotente —');
  const { data: checkout } = await req('/billing/checkout', {
    token: tokenPf,
    method: 'POST',
    body: { plano_slug: 'pf_plus' },
  });
  assert(checkout.ok && checkout.fatura_id, 'checkout mock');
  const extRef = paymentExternalRef(checkout.fatura_id);
  const webhookBody = {
    event: 'PAYMENT_RECEIVED',
    payment: {
      id: checkout.gateway_payment_id,
      externalReference: extRef,
      status: 'RECEIVED',
      value: 29.9,
    },
  };
  const wh1 = await req('/billing/webhook/asaas', { method: 'POST', body: webhookBody });
  assert(wh1.data.ok, 'webhook pago');
  const { data: sub } = await req('/billing/assinatura', { token: tokenPf });
  assert(sub.assinatura.status === 'ativa', 'assinatura ativa');
  const { data: faturas } = await req('/billing/faturas', { token: tokenPf });
  assert(faturas.faturas?.some((f) => f.status === 'paga'), 'fatura paga');
  const wh2 = await req('/billing/webhook/asaas', { method: 'POST', body: webhookBody });
  assert(wh2.data.duplicate === true, 'webhook duplicado idempotente');
}

async function testAtualizarStatus(tokenPf) {
  console.log('\n— Atualizar status cobrança —');
  const { data } = await req('/billing/atualizar-status', {
    token: tokenPf,
    method: 'POST',
    body: {},
  });
  assert(data.ok !== false, 'atualizar-status ok');
}

async function testOnboardingPersist(tokenPf) {
  console.log('\n— Persistência onboarding via state —');
  const dados = (await req('/state', { token: tokenPf })).data.dados;
  dados.empresas[0].onboardingEtapa = 'pf-2';
  dados.empresas[0].onboardingConcluido = false;
  await req('/state', { token: tokenPf, method: 'PUT', body: { dados } });
  const dados2 = (await req('/state', { token: tokenPf })).data.dados;
  assert(dados2.empresas[0].onboardingEtapa === 'pf-2', 'etapa persistida');
  dados2.empresas[0].onboardingConcluido = true;
  await req('/state', { token: tokenPf, method: 'PUT', body: { dados: dados2 } });
  const dados3 = (await req('/state', { token: tokenPf })).data.dados;
  assert(dados3.empresas[0].onboardingConcluido === true, 'onboarding concluído');
}

async function main() {
  console.log('=== Testes Etapa 7.1 ===\n');
  await runMigrations();

  testOnboardingInitialState();
  testPublicMessages71();
  testPdfExportSource();
  testCommercialPlanIgnoresDbLimit();

  const emailPf = `test_71_pf_${TS}@test.local`;
  const emailAdmin = `test_71_admin_${TS}@test.local`;
  const pass = 'test123456';
  await cleanup([emailPf, emailAdmin]);

  await createUser({
    email: emailAdmin,
    senha: pass,
    tipo: 'juridica',
    nomePerfil: 'Admin 71',
    role: 'admin',
  });
  await createUser({
    email: emailPf,
    senha: pass,
    tipo: 'fisica',
    nomePerfil: 'PF 71',
  });

  const tokenPf = await login(emailPf, pass);
  const tokenAdmin = await login(emailAdmin, pass);

  await testOnboardingPersist(tokenPf);
  await testConviteInfo();
  await testAdminOverview(tokenAdmin, tokenPf);
  await testWhatsappLimit(tokenPf);
  await testBillingMockCheckout(tokenPf);
  await testAtualizarStatus(tokenPf);

  await cleanup([emailPf, emailAdmin, `test_71_owner_${TS}@test.local`, `test_71_inv_${TS}@test.local`]);

  console.log('\n✅ Todos os testes 7.1 passaram.\n');
  await pool.end();
}

main().catch((err) => {
  console.error('\n❌', err.message);
  pool.end().finally(() => process.exit(1));
});
