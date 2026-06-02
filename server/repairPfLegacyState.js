/**
 * Reparo seguro de estado PF legado (consolida empresas + root lancamentos).
 * Uso:
 *   node server/repairPfLegacyState.js <email> --dry-run
 *   node server/repairPfLegacyState.js <email>
 *
 * Funções exportadas também usadas por diagnosticoPfEstado.js
 */
import { config } from 'dotenv';
config();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, pool } from './db.js';
import { normalizeStateForUser } from './initialState.js';
import { profileForPf } from './integracaoPfPj/estadoMerge.js';
import { normalizeTipoPerfil } from './profileTipo.js';

// ── Lógica compartilhada (diagnóstico + reparo) ───────────────────────────────

export function parseDados(dados) {
  if (dados == null) return null;
  if (typeof dados === 'string') {
    try {
      return JSON.parse(dados);
    } catch {
      return null;
    }
  }
  return dados;
}

function resolveActiveIndex(dados) {
  const empresas = dados?.empresas || [];
  if (!empresas.length) return 0;
  const activeId = dados.empresaAtivaId;
  const idx = activeId ? empresas.findIndex((e) => e.id === activeId) : -1;
  return idx >= 0 ? idx : 0;
}

export function collectLancamentosRaw(dados) {
  const parsed = parseDados(dados);
  if (!parsed) return { all: [], bySource: {} };

  const tagged = [];
  const push = (list, location, empresaIndex, empresaId, empresaNome) => {
    for (const l of list || []) {
      if (!l || !l.id) continue;
      tagged.push({
        ...l,
        _location: location,
        _empresaIndex: empresaIndex,
        _empresaId: empresaId,
        _empresaNome: empresaNome,
      });
    }
  };

  push(parsed.lancamentos, 'root', -1, null, '(root)');

  (parsed.empresas || []).forEach((emp, i) => {
    push(emp.lancamentos, `empresas[${i}]`, i, emp.id, emp.nome);
  });

  const bySource = {};
  for (const l of tagged) {
    const src = l.source || '(sem source)';
    bySource[src] = (bySource[src] || 0) + 1;
  }

  return { all: tagged, bySource };
}

function dedupeById(items) {
  const seen = new Map();
  const duplicates = [];

  for (const item of items) {
    const id = String(item.id);
    if (!id) continue;
    if (seen.has(id)) {
      duplicates.push({ id, first: seen.get(id), second: item });
      continue;
    }
    seen.set(id, item);
  }

  return {
    unique: [...seen.values()],
    duplicateCount: duplicates.length,
  };
}

function mergeFieldFromEmpresas(empresas, field) {
  const merged = [];
  const seen = new Set();
  for (const emp of empresas || []) {
    for (const item of emp[field] || []) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
    }
  }
  return merged;
}

function countVencimentoStatus(lancamentos) {
  let comVencimento = 0;
  let comStatus = 0;
  let comPago = 0;
  let abertos = 0;

  for (const l of lancamentos) {
    if (l.vencimento) comVencimento += 1;
    if (l.status) comStatus += 1;
    if (l.pago === true || l.status === 'pago') comPago += 1;
    else abertos += 1;
  }

  return { comVencimento, comStatus, comPago, abertos };
}

export function buildRepairedPfState(dados, userRow) {
  const parsed = parseDados(dados);
  if (!parsed?.empresas?.length) {
    throw new Error('Estado inválido: sem empresas.');
  }

  const profile = profileForPf(userRow);
  const activeIdx = resolveActiveIndex(parsed);
  const empresas = parsed.empresas || [];

  const { all: tagged } = collectLancamentosRaw(parsed);
  const { unique: lancamentosUnicos, duplicateCount } = dedupeById(
    tagged.map(({ _location, _empresaIndex, _empresaId, _empresaNome, ...l }) => l)
  );

  const rootLanc = Array.isArray(parsed.lancamentos) ? parsed.lancamentos.length : 0;

  const base =
    empresas.find((e) => e.tipo === 'fisica') ||
    empresas.find((e) => e.id === parsed.empresaAtivaId) ||
    empresas[activeIdx] ||
    empresas[0];

  const singleEmp = {
    ...base,
    tipo: 'fisica',
    lancamentos: lancamentosUnicos,
    contas: mergeFieldFromEmpresas(empresas, 'contas').length
      ? mergeFieldFromEmpresas(empresas, 'contas')
      : base.contas || [],
    planoContas: mergeFieldFromEmpresas(empresas, 'planoContas').length
      ? mergeFieldFromEmpresas(empresas, 'planoContas')
      : base.planoContas || [],
    metas: mergeFieldFromEmpresas(empresas, 'metas').length
      ? mergeFieldFromEmpresas(empresas, 'metas')
      : base.metas || [],
    orcamentos: mergeFieldFromEmpresas(empresas, 'orcamentos').length
      ? mergeFieldFromEmpresas(empresas, 'orcamentos')
      : base.orcamentos || [],
    fechamentos: mergeFieldFromEmpresas(empresas, 'fechamentos').length
      ? mergeFieldFromEmpresas(empresas, 'fechamentos')
      : base.fechamentos || [],
    clientes: mergeFieldFromEmpresas(empresas, 'clientes').length
      ? mergeFieldFromEmpresas(empresas, 'clientes')
      : base.clientes || [],
    fornecedores: mergeFieldFromEmpresas(empresas, 'fornecedores').length
      ? mergeFieldFromEmpresas(empresas, 'fornecedores')
      : base.fornecedores || [],
  };

  const { lancamentos: _r, recorrencias: _rec, ...rest } = parsed;
  const preNormalized = {
    ...rest,
    empresas: [singleEmp],
    empresaAtivaId: singleEmp.id,
  };

  const normalized = normalizeStateForUser(preNormalized, profile);

  return {
    repaired: normalized,
    stats: {
      lancamentosUnicos: lancamentosUnicos.length,
      duplicateCount,
      rootLancamentos: rootLanc,
      mergedContas: singleEmp.contas?.length ?? 0,
      mergedMetas: singleEmp.metas?.length ?? 0,
      mergedOrcamentos: singleEmp.orcamentos?.length ?? 0,
    },
  };
}

export function analyzePfEstado(dados, { empresaAtivaId } = {}) {
  const parsed = parseDados(dados);
  if (!parsed) return { valid: false, error: 'dados inválidos' };

  const activeId = empresaAtivaId || parsed.empresaAtivaId;
  const activeIdx = resolveActiveIndex(parsed);
  const { all: tagged, bySource } = collectLancamentosRaw(parsed);

  const uniqueIds = new Set(tagged.map((l) => String(l.id)));
  const idsInActive = new Set(
    (parsed.empresas?.[activeIdx]?.lancamentos || []).map((l) => String(l.id))
  );

  let emEmpresasInativas = 0;
  const porEmpresa = (parsed.empresas || []).map((emp, i) => {
    const count = (emp.lancamentos || []).length;
    const isActive = i === activeIdx || emp.id === activeId;
    if (!isActive) emEmpresasInativas += count;
    return {
      index: i,
      id: emp.id,
      nome: emp.nome,
      tipo: emp.tipo,
      ativa: isActive,
      lancamentos: count,
      metas: (emp.metas || []).length,
      orcamentos: (emp.orcamentos || []).length,
      contas: (emp.contas || []).length,
      planoContas: (emp.planoContas || []).length,
    };
  });

  const emRoot = (parsed.lancamentos || []).length;

  const vencStats = countVencimentoStatus(
    tagged.map(({ _location, _empresaIndex, _empresaId, _empresaNome, ...l }) => l)
  );

  return {
    valid: true,
    empresaAtivaId: activeId,
    empresaAtivaIndex: activeIdx,
    rootLancamentos: emRoot,
    rootRecorrencias: Array.isArray(parsed.recorrencias) ? parsed.recorrencias.length : 0,
    empresasCount: (parsed.empresas || []).length,
    porEmpresa,
    totalLancamentosTagged: tagged.length,
    totalLancamentosUnicos: uniqueIds.size,
    duplicadosPorId: tagged.length - uniqueIds.size,
    emEmpresasInativas,
    emRoot,
    bySource,
    vencimentoStatus: vencStats,
  };
}

export function assertPfUser(user) {
  const tipo = normalizeTipoPerfil(user.tipo_perfil);
  if (tipo !== 'fisica') {
    throw new Error(
      `Usuário ${user.email} é ${tipo}, não PF. Este script só repara contas físicas.`
    );
  }
  return tipo;
}

// ── CLI reparo ────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(__dirname, 'backups');
const isMain = process.argv[1] === fileURLToPath(import.meta.url);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const email = args.find((a) => !a.startsWith('--'))?.trim().toLowerCase();

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

async function runRepairCli() {
  if (!email) {
    console.error('Uso: node server/repairPfLegacyState.js <email> [--dry-run]');
    process.exit(1);
  }

  const { rows: users } = await query(
    `SELECT id, email, nome, nome_perfil, tipo_perfil, ativo
     FROM usuarios WHERE LOWER(email) = LOWER($1)`,
    [email]
  );

  if (!users.length) {
    console.error(`Usuário não encontrado: ${email}`);
    process.exit(1);
  }

  const user = users[0];
  assertPfUser(user);

  const { rows: est } = await query(
    'SELECT usuario_id, dados, updated_at FROM estados WHERE usuario_id = $1',
    [user.id]
  );

  if (!est.length) {
    console.error('Sem registro em estados.');
    process.exit(1);
  }

  const before = est[0].dados;
  const antes = analyzePfEstado(before);
  const idsAntes = new Set(collectLancamentosRaw(before).all.map((l) => String(l.id)));

  const visiveisAntes =
    antes.porEmpresa.find((e) => e.ativa)?.lancamentos ?? 0;

  const { repaired, stats } = buildRepairedPfState(before, user);
  const depois = analyzePfEstado(repaired);
  const idsDepois = new Set(collectLancamentosRaw(repaired).all.map((l) => String(l.id)));

  const recuperados = [...idsDepois].filter((id) => !idsAntes.has(id)).length;
  const visiveisDepois = depois.porEmpresa[0]?.lancamentos ?? 0;
  const ganhoUi = visiveisDepois - visiveisAntes;

  const integracao = (collectLancamentosRaw(repaired).all || []).filter(
    (l) => l.source === 'integracao_pf_pj'
  ).length;
  const whatsapp = (collectLancamentosRaw(repaired).all || []).filter(
    (l) => l.source === 'whatsapp' || l.source === 'WhatsApp'
  ).length;
  const manual = (collectLancamentosRaw(repaired).all || []).filter(
    (l) => !l.source || l.source === 'manual'
  ).length;

  console.log('=== Reparo PF legado —', email, dryRun ? '(DRY-RUN)' : '', '===\n');
  console.log('usuario_id:', user.id);

  console.log('\n--- Antes ---');
  console.log('Empresas:              ', antes.empresasCount);
  console.log('Lanç. únicos (JSONB):  ', antes.totalLancamentosUnicos);
  console.log('Lanç. na empresa ativa:', visiveisAntes);
  console.log('Em empresas inativas:  ', antes.emEmpresasInativas);
  console.log('Em root:               ', antes.emRoot);
  console.log('Duplicados por id:     ', antes.duplicadosPorId);

  console.log('\n--- Depois (simulado) ---');
  console.log('Empresas:              ', depois.empresasCount);
  console.log('Lanç. únicos:          ', depois.totalLancamentosUnicos);
  console.log('Lanç. na empresa única:', visiveisDepois);
  console.log('Recuperados (novos id):', recuperados);
  console.log('Ganho visível na UI:   ', ganhoUi, '(lançamentos que passam a aparecer)');
  console.log('Duplicados removidos:  ', stats.duplicateCount);
  console.log('Root absorvidos:       ', stats.rootLancamentos);
  console.log('Preservados integração:', integracao);
  console.log('Preservados WhatsApp:  ', whatsapp);
  console.log('Outros/manual:         ', manual);
  console.log('Vencimento/status:     ', depois.vencimentoStatus);

  const changed = JSON.stringify(before) !== JSON.stringify(repaired);
  if (!changed) {
    console.log('\n✓ Estado já está normalizado — nenhuma alteração necessária.');
    await pool.end();
    return;
  }

  if (dryRun) {
    console.log('\n[DRY-RUN] Nenhuma gravação. Remova --dry-run para aplicar.');
    await pool.end();
    return;
  }

  ensureBackupDir();
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(
    BACKUP_DIR,
    `pf-${user.id}-${ts}.json`
  );
  fs.writeFileSync(
    backupFile,
    JSON.stringify(
      {
        backed_at: new Date().toISOString(),
        usuario_id: user.id,
        email: user.email,
        dados: before,
      },
      null,
      2
    ),
    'utf8'
  );
  console.log('\nBackup gravado:', backupFile);

  await query(
    'UPDATE estados SET dados = $1, updated_at = NOW() WHERE usuario_id = $2',
    [JSON.stringify(repaired), user.id]
  );

  console.log('✓ Estado PF reparado e persistido.');
  console.log('  Peça ao usuário recarregar o app (F5) para ver os lançamentos.');

  await pool.end();
}

if (isMain) {
  runRepairCli().catch(async (err) => {
    console.error('Erro:', err.message);
    try { await pool.end(); } catch { /* ignore */ }
    process.exit(1);
  });
}
