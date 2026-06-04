/**
 * Testes Etapa 7.7 — Beta fechado, feedback e checklist
 * npm run test:77
 */
import { config } from 'dotenv';
config();

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { query, pool } from './db.js';
import { runMigrations } from './migrate.js';
import { isBetaMode, getBetaPublicConfig } from './beta/betaConfig.js';
import { normalizeFeedbackTipo } from './beta/feedbackService.js';
import { CHECKLIST_PF, CHECKLIST_PJ, getUserBetaChecklist } from './beta/userChecklist.js';

process.env.BETA_MODE = 'true';
process.env.BILLING_USE_MOCK_GATEWAY = 'true';

const BASE = `http://127.0.0.1:${process.env.PORT || 3001}/api`;
const TS = Date.now();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

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

async function waitApi() {
  for (let i = 0; i < 25; i++) {
    try {
      if ((await fetch(`${BASE}/status`)).ok) return;
    } catch {
      /* */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('API offline — execute npm run server');
}

async function main() {
  console.log('=== Testes Etapa 7.7 ===\n');
  await runMigrations();

  const mig = readFileSync(join(ROOT, 'server/migrations/034_feedback_beta.sql'), 'utf8');
  assert(mig.includes('feedback_beta'), 'migration 034 feedback_beta');
  assert(mig.includes('beta_checklist_progress'), 'migration 034 checklist progress');

  console.log('\n— beta config —');
  process.env.BETA_MODE = 'true';
  assert(isBetaMode(), 'BETA_MODE ativo');
  const pub = getBetaPublicConfig();
  assert(pub.betaMode && pub.message, 'getBetaPublicConfig mensagem');
  assert(normalizeFeedbackTipo('dúvida') === 'duvida', 'normaliza tipo dúvida');
  assert(CHECKLIST_PF.length === 5, 'checklist PF 5 itens');
  assert(CHECKLIST_PJ.length === 6, 'checklist PJ 6 itens');

  console.log('\n— arquivos frontend —');
  const fe = [
    'src/gestor/components/beta/BetaFeedbackFab.jsx',
    'src/gestor/components/beta/BetaChecklistCard.jsx',
    'src/gestor/pages/AdminBetaPage.jsx',
    'src/gestor/beta/betaInviteTemplate.js',
  ];
  for (const f of fe) assert(existsSync(join(ROOT, f)), `${f} existe`);

  const pkg = readFileSync(join(ROOT, 'package.json'), 'utf8');
  assert(pkg.includes('"test:77"'), 'script test:77 no package.json');

  console.log('\n— API (servidor) —');
  await waitApi();

  const emailAdmin = `admin77_${TS}@fluxiva.test`;
  const emailUser = `beta77_${TS}@fluxiva.test`;
  const hash = await bcrypt.hash('Test77!abc', 10);

  const { rows: adminRows } = await query(
    `INSERT INTO usuarios (email, nome, senha_hash, role, tipo_perfil, ativo)
     VALUES ($1, 'Admin 77', $2, 'admin', 'juridica', true) RETURNING id`,
    [emailAdmin, hash]
  );
  const adminId = adminRows[0].id;

  const { rows: userRows } = await query(
    `INSERT INTO usuarios (email, nome, senha_hash, role, tipo_perfil, nome_perfil, ativo)
     VALUES ($1, 'Beta User', $2, 'user', 'fisica', 'PF Beta', true) RETURNING id`,
    [emailUser, hash]
  );
  const userId = userRows[0].id;

  const { ensureAssinaturaPadrao } = await import('./billing/subscriptions.js');
  await ensureAssinaturaPadrao(userId);

  await query(
    `INSERT INTO estados (usuario_id, dados) VALUES ($1, $2)
     ON CONFLICT (usuario_id) DO UPDATE SET dados = EXCLUDED.dados`,
    [
      userId,
      JSON.stringify({
        empresas: [{ id: 'e1', nome: 'PF Beta', tipo: 'fisica', tourConcluido: true, lancamentos: [{ id: 1 }] }],
        empresaAtivaId: 'e1',
      }),
    ]
  );

  const { data: loginAdmin } = await req('/auth/login', {
    method: 'POST',
    body: { email: emailAdmin, senha: 'Test77!abc' },
  });
  const adminToken = loginAdmin.token;
  assert(adminToken, 'login admin');

  const { data: loginUser } = await req('/auth/login', {
    method: 'POST',
    body: { email: emailUser, senha: 'Test77!abc' },
  });
  const userToken = loginUser.token;
  assert(userToken, 'login beta user');

  const { data: cfg } = await req('/beta/config');
  assert(cfg.betaMode === true, 'GET /beta/config betaMode');

  const clDirect = await getUserBetaChecklist(userId, 'fisica');
  assert(clDirect.total === 5, 'checklist lib PF 5 itens');

  const { data: cl } = await req('/beta/checklist', { token: userToken });
  assert(cl.betaMode === true && cl.checklist, 'checklist beta ativo');
  assert(cl.checklist.total === clDirect.total, 'API checklist alinhado à lib');
  assert(cl.checklist.items.some((i) => i.key === 'onboarding' && i.done), 'onboarding detectado');

  const { data: fbPost } = await req('/beta/feedback', {
    method: 'POST',
    token: userToken,
    body: { tela: 'dashboard', tipo: 'sugestao', mensagem: 'Teste feedback 77' },
  });
  assert(fbPost.feedback?.id, 'POST feedback');

  await req('/beta/checklist/mark', {
    method: 'POST',
    token: userToken,
    body: { item_key: 'pdf_export' },
  });

  const denied = await req('/beta/feedback', { token: userToken, allowError: true });
  assert(denied.status === 403, 'GET feedback negado para user');

  const { data: fbList } = await req('/beta/feedback', { token: adminToken });
  assert(fbList.feedbacks?.length >= 1, 'admin lista feedbacks');

  const fid = fbList.feedbacks[0].id;
  const { data: patched } = await req(`/beta/feedback/${fid}`, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'em_analise' },
  });
  assert(patched.feedback?.status === 'em_analise', 'PATCH status feedback');

  const { data: summary } = await req('/beta/admin/summary', { token: adminToken });
  assert(summary.feedback?.total >= 1, 'admin summary total');
  assert(typeof summary.checklist_medio_percent === 'number', 'checklist médio');

  const { data: sys } = await req('/system/config-status');
  assert(sys.beta?.betaMode === true, 'config-status inclui beta');

  await query('DELETE FROM feedback_beta WHERE usuario_id = $1', [userId]);
  await query('DELETE FROM beta_checklist_progress WHERE usuario_id = $1', [userId]);
  await query('DELETE FROM estados WHERE usuario_id = $1', [userId]);
  await query('DELETE FROM usuarios WHERE id IN ($1, $2)', [adminId, userId]);

  console.log('\n=== Etapa 7.7 OK ===\n');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
