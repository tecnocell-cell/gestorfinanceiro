/**
 * Auditoria de categorias PF (estado atual, empresas[], backups, legado).
 * Uso: node server/auditCategoriasPf.js [email]
 */
import { config } from 'dotenv';
config();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, pool } from './db.js';
import { parseDados, collectLancamentosRaw } from './repairPfLegacyState.js';
import {
  isPlanoContasPJ,
  isSomenteAssinaturasPjPadrao,
  PF_DESCRICOES_PADRAO,
} from '../src/gestor/categoriasPfUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(__dirname, 'backups');

function listPlanos(planos, label) {
  console.log(`\n── ${label} (${(planos || []).length}) ──`);
  for (const p of planos || []) {
    const pj = isPlanoContasPJ(p) ? ' [PJ]' : ' [PF?]';
    console.log(`  ${p.id?.slice(0, 8)}… | ${p.codigo} | ${p.tipo} | ${p.descricao}${pj}`);
  }
}

function scanBackupFiles(userId) {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  const hits = [];
  for (const name of fs.readdirSync(BACKUP_DIR)) {
    if (!name.endsWith('.json')) continue;
    if (userId && !name.includes(String(userId))) continue;
    const full = path.join(BACKUP_DIR, name);
    try {
      const raw = JSON.parse(fs.readFileSync(full, 'utf8'));
      const dados = parseDados(raw);
      if (!dados?.empresas) continue;
      const planos = dados.empresas.flatMap((e, i) =>
        (e.planoContas || []).map((p) => ({ ...p, _empresa: i, _file: name }))
      );
      hits.push({ file: name, planos, dados });
    } catch {
      /* skip */
    }
  }
  return hits;
}

async function auditUser(user) {
  console.log('\n════════════════════════════════════════');
  console.log(`Usuário: ${user.email} (${user.id})`);
  console.log(`tipo_perfil: ${user.tipo_perfil}`);

  const { rows } = await query('SELECT dados FROM estados WHERE usuario_id = $1', [user.id]);
  const dados = parseDados(rows[0]?.dados);
  if (!dados) {
    console.log('  (sem estado)');
    return;
  }

  const empresas = dados.empresas || [];
  const ativa = empresas.find((e) => e.id === dados.empresaAtivaId) || empresas[0];
  const planoAtivo = ativa?.planoContas || [];

  console.log('\n▶ Estado atual (empresa ativa)');
  listPlanos(planoAtivo, 'planoContas ativo');
  if (isSomenteAssinaturasPjPadrao(planoAtivo)) {
    console.log('\n  ⚠ ALERTA: somente assinaturas PJ padrão na empresa ativa');
  }

  console.log('\n▶ Por slot em empresas[]');
  empresas.forEach((emp, i) => {
    console.log(`  empresas[${i}] tipo=${emp.tipo} nome=${emp.nome}`);
    listPlanos(emp.planoContas, `planoContas empresas[${i}]`);
  });

  const { all: lancs } = collectLancamentosRaw(dados);
  const planoIdsUsados = new Set(lancs.map((l) => l.planoId).filter(Boolean));
  console.log(`\n▶ planoId em ${lancs.length} lançamentos (${planoIdsUsados.size} ids distintos)`);

  const rootLanc = dados.lancamentos?.length || 0;
  if (rootLanc) {
    console.log(`\n▶ Legado: dados.lancamentos[] na raiz (${rootLanc} itens)`);
  }

  const backups = scanBackupFiles(user.id);
  console.log(`\n▶ Backups em server/backups (${backups.length} arquivos com estado)`);
  const pfDescFromBackups = new Set();
  for (const b of backups) {
    const pf = b.planos.filter((p) => !isPlanoContasPJ(p));
    const pj = b.planos.filter((p) => isPlanoContasPJ(p));
    console.log(`  ${b.file}: PF=${pf.length} PJ=${pj.length}`);
    pf.forEach((p) => pfDescFromBackups.add(p.descricao));
  }

  const faltando = PF_DESCRICOES_PADRAO.filter((d) => !pfDescFromBackups.has(d));
  if (backups.length && faltando.length) {
    console.log(`  PF histórico em backups — faltam no template: ${faltando.join(', ') || '(nenhum)'}`);
  }

  const merged = empresas.flatMap((e) => e.planoContas || []);
  const pfHist = merged.filter((p) => !isPlanoContasPJ(p));
  console.log(`\n▶ Resumo merge empresas[]: ${pfHist.length} PF-like, ${merged.length - pfHist.length} PJ-like`);
}

async function main() {
  const email = process.argv[2];
  let users;
  if (email) {
    const r = await query(
      `SELECT id, email, tipo_perfil FROM usuarios WHERE LOWER(email) = LOWER($1)`,
      [email]
    );
    users = r.rows;
    if (!users.length) {
      console.error('Usuário não encontrado:', email);
      process.exit(1);
    }
  } else {
    const r = await query(
      `SELECT u.id, u.email, u.tipo_perfil FROM usuarios u
       JOIN estados e ON e.usuario_id = u.id
       WHERE u.tipo_perfil = 'fisica'`
    );
    users = r.rows;
    console.log(`Auditoria: ${users.length} contas PF com estado`);
  }

  for (const u of users) {
    await auditUser(u);
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
