/**
 * Restaura categorias PF perdidas; remove PJ indevidas; preserva IDs em uso.
 * Uso:
 *   node server/repairCategoriasPf.js <email> --dry-run
 *   node server/repairCategoriasPf.js <email>
 */
import { config } from 'dotenv';
config();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { query, pool } from './db.js';
import { normalizeStateForUser } from './initialState.js';
import { parseDados, collectLancamentosRaw } from './repairPfLegacyState.js';
import { normalizeMoneyInState } from './normalizeEstadoMoney.js';
import {
  isPlanoContasPJ,
  isSomenteAssinaturasPjPadrao,
  selectPlanoContasForPf,
  dedupePlanosById,
  descricaoKey,
  PF_DESCRICOES_PADRAO,
} from '../src/gestor/categoriasPfUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(__dirname, 'backups');

function defaultCategoriasPFRepair() {
  const templates = [
    ['1.1', 'RECEITA', 'Salário', 'Receita', 'Credito'],
    ['1.2', 'RECEITA', 'Freelance', 'Receita', 'Credito'],
    ['1.3', 'RECEITA', 'Investimentos', 'Receita', 'Credito'],
    ['1.4', 'RECEITA', 'Outros Recebimentos', 'Receita', 'Credito'],
    ['2.1', 'DESPESA', 'Moradia', 'Despesa', 'Debito'],
    ['2.2', 'DESPESA', 'Alimentação', 'Despesa', 'Debito'],
    ['2.3', 'DESPESA', 'Transporte', 'Despesa', 'Debito'],
    ['2.4', 'DESPESA', 'Saúde', 'Despesa', 'Debito'],
    ['2.5', 'DESPESA', 'Educação', 'Despesa', 'Debito'],
    ['2.6', 'DESPESA', 'Lazer', 'Despesa', 'Debito'],
    ['2.7', 'DESPESA', 'Vestuário', 'Despesa', 'Debito'],
    ['2.8', 'DESPESA', 'Outros Gastos', 'Despesa', 'Debito'],
  ];
  return templates.map(([codigo, classificacao, descricao, tipo, natureza]) => ({
    id: randomUUID(),
    codigo,
    classificacao,
    descricao,
    tipo,
    natureza,
    caixaBanco: '',
    contaContabil: '',
    inativo: false,
    usarSaldo: true,
  }));
}

function collectPlanosFromBackups(userId) {
  const out = [];
  if (!fs.existsSync(BACKUP_DIR)) return out;
  for (const name of fs.readdirSync(BACKUP_DIR)) {
    if (!name.endsWith('.json') || !name.includes(String(userId))) continue;
    try {
      const dados = parseDados(JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, name), 'utf8')));
      for (const emp of dados?.empresas || []) {
        for (const p of emp.planoContas || []) {
          if (!isPlanoContasPJ(p)) out.push(p);
        }
      }
    } catch {
      /* skip */
    }
  }
  return out;
}

function buildRepairedPlano(dados, user) {
  const empresas = dados.empresas || [];
  const merged = empresas.flatMap((e) => e.planoContas || []);
  const { all: lancs } = collectLancamentosRaw(dados);
  const usedIds = new Set(lancs.map((l) => l.planoId).filter(Boolean));

  const historico = [
    ...collectPlanosFromBackups(user.id),
    ...merged.filter((p) => !isPlanoContasPJ(p)),
  ];

  const byDesc = new Map();
  const byId = new Map();

  for (const p of historico) {
    if (!p?.id) continue;
    byId.set(p.id, p);
    const k = descricaoKey(p.descricao);
    if (!byDesc.has(k)) byDesc.set(k, p);
  }

  for (const p of merged) {
    if (usedIds.has(p.id)) byId.set(p.id, p);
  }

  const defaults = defaultCategoriasPFRepair();
  for (const d of defaults) {
    const k = descricaoKey(d.descricao);
    if (!byDesc.has(k)) {
      byDesc.set(k, d);
      byId.set(d.id, d);
    }
  }

  let planos = dedupePlanosById([...byId.values()]);

  const ativos = planos.filter((p) => !p.inativo);
  if (isSomenteAssinaturasPjPadrao(ativos)) {
    planos = selectPlanoContasForPf(merged, empresas, lancs, defaultCategoriasPFRepair);
  } else {
    planos = planos.filter(
      (p) => !isPlanoContasPJ(p) || usedIds.has(p.id)
    );
    if (!planos.some((p) => !isPlanoContasPJ(p))) {
      planos = selectPlanoContasForPf(merged, empresas, lancs, defaultCategoriasPFRepair);
    }
  }

  const pfCount = planos.filter((p) => !isPlanoContasPJ(p)).length;
  if (pfCount < 4) {
    planos = selectPlanoContasForPf(merged, empresas, lancs, defaultCategoriasPFRepair);
  }

  return { planos: dedupePlanosById(planos), pfCount };
}

async function main() {
  const email = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');
  if (!email) {
    console.error('Uso: node server/repairCategoriasPf.js <email> [--dry-run]');
    process.exit(1);
  }

  const { rows: users } = await query(
    `SELECT id, email, nome, nome_perfil, tipo_perfil FROM usuarios WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  if (!users.length) {
    console.error('Usuário não encontrado:', email);
    process.exit(1);
  }
  const user = users[0];
  if (user.tipo_perfil !== 'fisica') {
    console.error('Conta deve ser tipo_perfil = fisica');
    process.exit(1);
  }

  const { rows } = await query('SELECT dados FROM estados WHERE usuario_id = $1', [user.id]);
  const dados = parseDados(rows[0]?.dados);
  if (!dados?.empresas?.length) {
    console.error('Estado inválido');
    process.exit(1);
  }

  const antes = (dados.empresas[0]?.planoContas || []).map((p) => p.descricao);
  const { planos, pfCount } = buildRepairedPlano(dados, user);

  const profile = {
    tipo_perfil: 'fisica',
    nome_perfil: user.nome_perfil || user.nome,
    nome: user.nome,
  };

  let repaired = {
    ...dados,
    empresas: dados.empresas.map((emp, i) =>
      i === 0 ? { ...emp, tipo: 'fisica', planoContas: planos } : emp
    ),
  };
  if (repaired.empresas.length > 1) {
    const emp0 = repaired.empresas[0];
    repaired = normalizeStateForUser(
      { ...repaired, empresas: [emp0] },
      profile
    );
  } else {
    repaired = normalizeStateForUser(repaired, profile);
  }
  repaired = normalizeMoneyInState(repaired);

  const depois = (repaired.empresas[0]?.planoContas || []).map((p) => p.descricao);
  console.log('Antes:', antes.join(', '));
  console.log('Depois:', depois.join(', '));
  console.log(`Categorias PF-like: ${pfCount}`);

  if (isSomenteAssinaturasPjPadrao(repaired.empresas[0]?.planoContas)) {
    console.error('Reparo falhou: ainda somente PJ padrão');
    process.exit(1);
  }

  const faltam = PF_DESCRICOES_PADRAO.filter(
    (d) => !depois.some((x) => descricaoKey(x) === descricaoKey(d))
  );
  if (faltam.length > 6) {
    console.warn('Aviso: faltam descrições PF padrão:', faltam.join(', '));
  }

  if (dryRun) {
    console.log('\n--dry-run: nenhuma gravação');
    await pool.end();
    return;
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `pf-categorias-${user.id}-${ts}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(dados, null, 2));
  console.log('Backup:', backupFile);

  await query(
    'UPDATE estados SET dados = $2, updated_at = NOW() WHERE usuario_id = $1',
    [user.id, JSON.stringify(repaired)]
  );
  console.log('Estado PF atualizado.');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
