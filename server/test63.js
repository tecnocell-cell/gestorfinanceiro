/**
 * Testes Etapa 6.3 / 6.3B — Planos comerciais e assinaturas
 * Uso: node server/test63.js
 * Requer servidor rodando: npm run server
 */
import { config } from 'dotenv';
config();

import bcrypt from 'bcryptjs';
import { query, pool } from './db.js';
import { createInitialState } from './initialState.js';
import { runMigrations } from './migrate.js';
import {
  mergeRecursos,
  DEFAULT_RESOURCES_BY_SLUG,
  COMMERCIAL_PLAN_SLUGS,
} from './billing/planResources.js';

const BASE = `http://127.0.0.1:${process.env.PORT || 3001}/api`;
const TS = Date.now();

const PRECOS = {
  pf_basico: 1990,
  pf_plus: 2990,
  pf_premium: 4990,
  pj_start: 5990,
  pj_pro: 9990,
  pj_business: 19990,
};

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
     ) VALUES ($1,$2,$3,'user',true,$4,$5,true) RETURNING id, email`,
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
    await query('DELETE FROM assinaturas WHERE usuario_id = $1', [id]);
    await query('DELETE FROM estados WHERE usuario_id = $1', [id]);
    await query('DELETE FROM usuarios WHERE id = $1', [id]);
  }
}

async function main() {
  console.log('=== Testes Etapa 6.3B — Planos comerciais ===\n');

  await runMigrations();

  const emailPf = `test_63_pf_${TS}@test.local`;
  const emailPj = `test_63_pj_${TS}@test.local`;
  const pass = 'test123456';
  await cleanup([emailPf, emailPj]);

  console.log('--- Planos seedados (comerciais) ---');
  const { rows: planosDb } = await query(
    `SELECT slug, preco_centavos, recursos, ativo FROM planos ORDER BY preco_centavos`
  );
  const ativos = planosDb.filter((p) => p.ativo);
  assert(ativos.length >= 6, 'pelo menos 6 planos comerciais ativos');

  for (const slug of COMMERCIAL_PLAN_SLUGS.pf) {
    assert(ativos.some((p) => p.slug === slug), `plano ${slug} ativo`);
    const row = ativos.find((p) => p.slug === slug);
    assert(row.preco_centavos === PRECOS[slug], `${slug}: preço ${PRECOS[slug]} centavos`);
    const rec = mergeRecursos(slug, row.recursos);
    assert(rec.openFinance === false, `${slug}: openFinance false`);
    assert(rec.openFinanceAddon?.ativo === false, `${slug}: addon inativo`);
    assert(rec.segmento === 'pf', `${slug}: segmento pf`);
  }

  for (const slug of COMMERCIAL_PLAN_SLUGS.pj) {
    assert(ativos.some((p) => p.slug === slug), `plano ${slug} ativo`);
    const row = ativos.find((p) => p.slug === slug);
    assert(row.preco_centavos === PRECOS[slug], `${slug}: preço correto`);
    const rec = mergeRecursos(slug, row.recursos);
    assert(rec.openFinance === false, `${slug}: openFinance false`);
    assert(rec.integracaoPfPj === true, `${slug}: integracaoPfPj true`);
  }

  const premium = mergeRecursos('pf_premium', ativos.find((p) => p.slug === 'pf_premium').recursos);
  assert(premium.whatsappComprovante === true, 'pf_premium: comprovante');
  assert(premium.suportePrioritario === true, 'pf_premium: suporte prioritário');
  assert(premium.limiteWhatsappNumeros === 5, 'pf_premium: 5 números');

  const pjPro = mergeRecursos('pj_pro', ativos.find((p) => p.slug === 'pj_pro').recursos);
  assert(pjPro.dreCompleto === true, 'pj_pro: DRE completo');
  assert(pjPro.limiteUsuarios === 8, 'pj_pro: 8 usuários');

  assert(DEFAULT_RESOURCES_BY_SLUG.pf_basico.limiteWhatsappNumeros === 1, 'helper pf_basico 1 whatsapp');

  const userPf = await createUser({
    email: emailPf,
    senha: pass,
    tipo: 'fisica',
    nomePerfil: 'PF Test 63',
  });
  const userPj = await createUser({
    email: emailPj,
    senha: pass,
    tipo: 'juridica',
    nomePerfil: 'PJ Test 63',
  });

  const tokenPf = await login(emailPf, pass);
  const tokenPj = await login(emailPj, pass);

  console.log('\n--- API planos por perfil ---');
  const listPf = await req('/billing/planos', { token: tokenPf });
  const slugsPf = (listPf.data.planos || []).map((p) => p.slug);
  assert(slugsPf.length === 3, 'PF: exatamente 3 planos');
  assert(
    COMMERCIAL_PLAN_SLUGS.pf.every((s) => slugsPf.includes(s)),
    'PF: slugs pf_basico, pf_plus, pf_premium'
  );
  assert(!slugsPf.some((s) => s.startsWith('pj_')), 'PF: sem planos PJ');

  const listPj = await req('/billing/planos', { token: tokenPj });
  const slugsPj = (listPj.data.planos || []).map((p) => p.slug);
  assert(slugsPj.length === 3, 'PJ: exatamente 3 planos');
  assert(
    COMMERCIAL_PLAN_SLUGS.pj.every((s) => slugsPj.includes(s)),
    'PJ: slugs pj_start, pj_pro, pj_business'
  );
  assert(!slugsPj.some((s) => s.startsWith('pf_')), 'PJ: sem planos PF');

  const pfPlusApi = listPf.data.planos.find((p) => p.slug === 'pf_plus');
  assert(pfPlusApi.preco_centavos === 2990, 'API pf_plus preço 2990');
  assert(pfPlusApi.recursos.whatsappAudio === true, 'API pf_plus áudio');

  console.log('\n--- Assinatura padrão por tipo ---');
  const subPf = await req('/billing/assinatura', { token: tokenPf });
  assert(subPf.data.assinatura?.plano?.slug === 'pf_basico', 'PF novo → pf_basico');
  assert(subPf.data.assinatura?.recursos?.openFinance === false, 'PF: openFinance false');

  const subPj = await req('/billing/assinatura', { token: tokenPj });
  assert(subPj.data.assinatura?.plano?.slug === 'pj_start', 'PJ novo → pj_start');

  console.log('\n--- Simular upgrade ---');
  const upPf = await req('/billing/assinatura/simular', {
    method: 'POST',
    token: tokenPf,
    body: { plano_slug: 'pf_premium' },
  });
  assert(upPf.data.ok, 'PF upgrade pf_premium ok');
  assert(upPf.data.assinatura?.plano?.slug === 'pf_premium', 'PF em premium');
  assert(upPf.data.assinatura?.recursos?.openFinance === false, 'premium: openFinance ainda false');

  const cross = await req('/billing/assinatura/simular', {
    method: 'POST',
    token: tokenPf,
    body: { plano_slug: 'pj_pro' },
    allowError: true,
  });
  assert(cross.status === 400, 'PF não pode simular plano PJ');

  const upPj = await req('/billing/assinatura/simular', {
    method: 'POST',
    token: tokenPj,
    body: { plano_slug: 'pj_pro' },
  });
  assert(upPj.data.assinatura?.plano?.slug === 'pj_pro', 'PJ upgrade pro');

  console.log('\n--- Open Finance mock (Banco Demo) ---');
  const ofStatus = await req('/open-finance/status', { token: tokenPf });
  assert(ofStatus.data.demoMode === true || ofStatus.data.provider === 'mock', 'OF status mock');

  const mockConn = await req('/open-finance/connections/mock', {
    method: 'POST',
    token: tokenPf,
    body: {},
  });
  assert(mockConn.data.connection?.id, 'Banco Demo Fluxiva ainda funciona');

  await cleanup([emailPf, emailPj]);
  await pool.end();

  console.log('\n=== Todos os testes 6.3B passaram ===\n');
}

main().catch((err) => {
  console.error(err);
  pool.end().finally(() => process.exit(1));
});
