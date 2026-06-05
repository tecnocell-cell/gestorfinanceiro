/**
 * Testes Etapa 8.2 — Homologação Real Controlada
 * npm run test:82
 */
import { config } from 'dotenv';
config();

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { query, pool } from './db.js';
import { runMigrations } from './migrate.js';
import {
  REAL_SECTIONS,
  REAL_HOMOLOG_KEY,
  getRealHomologacao,
  setRealHomologacaoItem,
  setRealHomologacaoMeta,
  generateRealHomologacaoReport,
} from './homologacao/realHomologacao.js';

const BASE = `http://127.0.0.1:${process.env.PORT || 3001}/api`;
const TS = Date.now();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function req(path, opts = {}) {
  const method = opts.method || (opts.body !== undefined ? 'POST' : 'GET');
  const res = await fetch(`${BASE}${path}`, {
    method,
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

async function ensureAdminToken() {
  const email = `admin82_${TS}@fluxiva.test`;
  const hash = await bcrypt.hash('Test82!real', 10);
  await query(
    `INSERT INTO usuarios (email, nome, senha_hash, role, tipo_perfil, ativo)
     VALUES ($1, 'Admin 82', $2, 'admin', 'juridica', true)`,
    [email, hash]
  );
  const login = await req('/auth/login', {
    body: { email, senha: 'Test82!real' },
  });
  assert(login.data.token, 'token admin');
  return login.data.token;
}

async function main() {
  console.log('=== Testes Etapa 8.2 — Homologação Real ===\n');
  await runMigrations();

  console.log('— arquivos —');
  const files = [
    'server/homologacao/realHomologacao.js',
    'server/test82.js',
    'src/gestor/pages/AdminRealHomologacaoPage.jsx',
  ];
  for (const f of files) assert(existsSync(join(ROOT, f)), `${f} existe`);

  const pkg = readFileSync(join(ROOT, 'package.json'), 'utf8');
  assert(pkg.includes('"test:82"'), 'script test:82');

  const nav = readFileSync(join(ROOT, 'src/gestor/admin/adminNav.js'), 'utf8');
  assert(nav.includes('admin-homologacao-real'), 'nav Homologação Real');
  assert(nav.includes('Homologação Real'), 'label Homologação Real');

  const app = readFileSync(join(ROOT, 'src/gestor/GestorApp.jsx'), 'utf8');
  assert(app.includes('AdminRealHomologacaoPage'), 'GestorApp importa página');
  assert(app.includes('admin-homologacao-real'), 'ADMIN_PAGE_MAP homologação real');

  const routes = readFileSync(join(ROOT, 'server/routes/adminRelease.js'), 'utf8');
  assert(routes.includes('/homologacao-real'), 'rota homologacao-real');
  assert(routes.includes('/homologacao-real/report'), 'rota relatório');

  console.log('\n— seções do checklist —');
  const sectionIds = Object.keys(REAL_SECTIONS);
  for (const id of ['pf', 'pj', 'pagamento', 'email', 'whatsapp', 'pdf', 'suporte', 'admin']) {
    assert(sectionIds.includes(id), `seção ${id}`);
    assert(REAL_SECTIONS[id].items.length > 0, `itens ${id}`);
  }
  const pfKeys = REAL_SECTIONS.pf.items.map((i) => i.key);
  for (const k of ['cadastro', 'pix_mp', 'webhook', 'assinatura_ativa']) {
    assert(pfKeys.includes(k), `PF item ${k}`);
  }
  const pjKeys = REAL_SECTIONS.pj.items.map((i) => i.key);
  for (const k of ['integracao_pj_pf', 'convite', 'dre']) {
    assert(pjKeys.includes(k), `PJ item ${k}`);
  }
  const adminKeys = REAL_SECTIONS.admin.items.map((i) => i.key);
  for (const k of ['reenviar_cobranca', 'conferir_mrr_arr']) {
    assert(adminKeys.includes(k), `admin item ${k}`);
  }

  console.log('\n— módulo checklist —');
  await query(`DELETE FROM system_config WHERE key = $1`, [REAL_HOMOLOG_KEY]);

  const empty = await getRealHomologacao();
  assert(empty.sections.length === sectionIds.length, 'todas seções retornadas');
  assert(empty.progress.total > 40, 'total de passos');
  assert(empty.progress.done === 0, 'inicia zerado');

  const check = await setRealHomologacaoItem({
    section: 'pf',
    key: 'cadastro',
    checked: true,
    adminEmail: 'admin@test',
  });
  assert(check.ok, 'marca item PF');
  assert(check.sections.find((s) => s.id === 'pf').progress.done >= 1, 'progresso PF');
  assert((check.activity || []).length >= 1, 'log de atividade');

  const uncheck = await setRealHomologacaoItem({
    section: 'pf',
    key: 'cadastro',
    checked: false,
    adminEmail: 'admin@test',
  });
  assert(uncheck.ok, 'desmarca item');

  const bad = await setRealHomologacaoItem({ section: 'xx', key: 'cadastro', checked: true });
  assert(!bad.ok, 'rejeita seção inválida');

  console.log('\n— meta e parecer —');
  const meta = await setRealHomologacaoMeta({
    usuario_pf: 'pf@test.com',
    usuario_pj: 'pj@test.com',
    falhas: 'Nenhuma',
    status: 'aprovado',
    adminEmail: 'admin@test',
  });
  assert(meta.ok, 'salva meta');
  assert(meta.meta.usuario_pf === 'pf@test.com', 'usuario PF');
  assert(meta.meta.status === 'aprovado', 'status aprovado');

  const badStatus = await setRealHomologacaoMeta({ status: 'invalido' });
  assert(!badStatus.ok, 'rejeita status inválido');

  console.log('\n— relatório —');
  await setRealHomologacaoItem({ section: 'pagamento', key: 'pix_gerado', checked: true, adminEmail: 'a' });
  const report = await generateRealHomologacaoReport();
  assert(report.generated_at, 'data de geração');
  assert(report.data, 'data legível');
  assert(report.usuario_testado.pf === 'pf@test.com', 'relatório usuario PF');
  assert(Array.isArray(report.passos_concluidos), 'passos concluídos');
  assert(report.passos_concluidos.length >= 1, 'tem passos');
  assert(Array.isArray(report.pendentes), 'pendentes');
  assert(['aprovado', 'reprovado', 'pendente'].includes(report.status), 'status válido');
  assert(report.signals, 'sinais automáticos');
  assert(typeof report.signals.pagamentos_recentes === 'number', 'sinal pagamentos');

  console.log('\n— API HTTP —');
  await waitApi();
  const token = await ensureAdminToken();

  const get = await req('/admin/homologacao-real', { token });
  assert(get.data.sections?.length === sectionIds.length, 'GET homologacao-real');

  const patch = await req('/admin/homologacao-real', {
    token,
    method: 'PATCH',
    body: { section: 'suporte', key: 'pagina_ajuda', checked: true },
  });
  assert(patch.data.ok, 'PATCH item');

  const patchMeta = await req('/admin/homologacao-real/meta', {
    token,
    method: 'PATCH',
    body: { status: 'reprovado', falhas: 'Teste reprovado' },
  });
  assert(patchMeta.data.meta?.status === 'reprovado', 'PATCH meta');

  const rep = await req('/admin/homologacao-real/report', { token });
  assert(rep.data.status, 'GET relatório');

  const hash = await bcrypt.hash('Test82!real', 10);
  const emailUser = `user82_${TS}@fluxiva.test`;
  await query(
    `INSERT INTO usuarios (email, nome, senha_hash, role, tipo_perfil, ativo)
     VALUES ($1, 'User 82', $2, 'user', 'fisica', true)`,
    [emailUser, hash]
  );
  const loginUser = await req('/auth/login', { body: { email: emailUser, senha: 'Test82!real' } });
  let denied = false;
  try {
    await req('/admin/homologacao-real', { token: loginUser.data.token });
  } catch {
    denied = true;
  }
  assert(denied, 'usuário comum não acessa');

  console.log('\n=== Todos os testes 8.2 passaram ===\n');
  await pool.end();
}

main().catch((err) => {
  console.error('\n' + err.message);
  pool.end().finally(() => process.exit(1));
});
