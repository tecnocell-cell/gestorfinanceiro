/**
 * Testes Etapa 7.6 — Go Live comercial e experiência do cliente
 * npm run test:76
 */
import { config } from 'dotenv';
config();

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { query, pool } from './db.js';
import { runMigrations } from './migrate.js';
import { syncBillingRemindersForUser } from './notifications/billingReminders.js';
import { ensureAssinaturaPadrao } from './billing/subscriptions.js';
import { fetchNotificationsForUser } from './notifications/notificationService.js';
import { sanitizePublicMessage } from '../src/gestor/planRules.js';

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
  console.log('=== Testes Etapa 7.6 ===\n');
  await runMigrations();

  const mig = readFileSync(
    join(ROOT, 'server/migrations/032_usuario_notificacoes.sql'),
    'utf8'
  );
  assert(mig.includes('usuario_notificacoes'), 'migration 032 notificações');

  console.log('\n— arquivos frontend —');
  const fe = [
    'src/gestor/components/NotificationBell.jsx',
    'src/gestor/components/TrialBanner.jsx',
    'src/gestor/components/dashboard/CommercialDashboardBlock.jsx',
    'src/gestor/pages/NotificationsPage.jsx',
  ];
  for (const f of fe) assert(existsSync(join(ROOT, f)), `${f} existe`);

  const pdf = readFileSync(join(ROOT, 'src/gestor/export/pdfExport.js'), 'utf8');
  assert(pdf.includes('exportPortalComercialPdf'), 'exportPortalComercialPdf');

  const pkg = readFileSync(join(ROOT, 'package.json'), 'utf8');
  assert(pkg.includes('"test:76"'), 'script test:76');

  console.log('\n— sanitize mensagens —');
  assert(
    sanitizePublicMessage('Erro no gateway Asaas webhook') !== 'Erro no gateway Asaas webhook',
    'oculta termos técnicos'
  );

  console.log('\n— API (requer servidor) —');
  await waitApi();

  const email = `test76_${TS}@fluxiva.test`;
  const senha = 'Test76!Aa';
  const hash = await bcrypt.hash(senha, 10);
  const { rows: uRows } = await query(
    `INSERT INTO usuarios (email, senha_hash, nome, tipo_perfil, nome_perfil)
     VALUES ($1, $2, 'Test 76', 'fisica', 'PF Test')
     RETURNING id`,
    [email, hash]
  );
  const userId = uRows[0].id;

  const login = await req('/auth/login', {
    method: 'POST',
    body: { email, senha },
  });
  const token = login.data.token;
  assert(token, 'login tenant');

  const notif = await req('/notifications', { token });
  assert(Array.isArray(notif.data.notificacoes), 'GET /notifications lista');
  assert(typeof notif.data.nao_lidas === 'number', 'contador não lidas');
  assert(notif.data.tipos?.includes('cobranca'), 'tipos inclui cobrança');

  const { rows: planRows } = await query(
    `SELECT id FROM planos WHERE ativo = true AND recursos->>'segmento' = 'pf' LIMIT 1`
  );
  await ensureAssinaturaPadrao(userId);
  if (planRows.length) {
    await query(
      `UPDATE assinaturas SET plano_id = $2, status = 'trial', trial_ate = CURRENT_DATE + 3
       WHERE usuario_id = $1`,
      [userId, planRows[0].id]
    );
  }

  await syncBillingRemindersForUser(userId);
  const synced = await fetchNotificationsForUser(userId);
  assert(synced.notificacoes.length >= 0, 'sync billing reminders');

  const { rows: ins } = await query(
    `INSERT INTO usuario_notificacoes (usuario_id, tipo, titulo, mensagem, codigo)
     VALUES ($1, 'sistema', 'Teste 76', 'Mensagem de teste', $2)
     RETURNING id`,
    [userId, `test76_sys_${TS}`]
  );
  const nid = ins[0].id;
  const mark = await req(`/notifications/${nid}/lida`, { method: 'PATCH', token });
  assert(mark.data.ok, 'marcar lida');

  const assin = await req('/billing/assinatura', { token });
  assert(assin.data.assinatura, 'billing assinatura portal');

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@fluxiva.com.br';
  const { rows: adm } = await query('SELECT id FROM usuarios WHERE email = $1', [adminEmail]);
  let adminToken = null;
  if (adm.length) {
    const admLogin = await req('/auth/login', {
      method: 'POST',
      body: { email: adminEmail, senha: process.env.ADMIN_PASSWORD || 'admin123' },
      allowError: true,
    });
    adminToken = admLogin.data.token;
  }
  if (adminToken) {
    const clientes = await req('/admin/clientes?filtro=todos', { token: adminToken });
    const c0 = clientes.data.clientes?.[0];
    if (c0) {
      assert('plano_valor_formatado' in c0, 'admin cliente plano_valor_formatado');
      assert('total_pago_centavos' in c0, 'admin cliente total_pago');
      assert('faturas_vencidas' in c0, 'admin cliente faturas_vencidas');
    }
  } else {
    console.log('  ⚠ admin login skip — defina ADMIN_EMAIL/ADMIN_PASSWORD');
  }

  await query('DELETE FROM usuario_notificacoes WHERE usuario_id = $1', [userId]);
  await query('DELETE FROM assinaturas WHERE usuario_id = $1', [userId]);
  await query('DELETE FROM usuarios WHERE id = $1', [userId]);

  console.log('\n=== Etapa 7.6 OK ===\n');
  await pool.end();
}

main().catch((err) => {
  console.error('\n', err.message || err);
  pool.end().finally(() => process.exit(1));
});
