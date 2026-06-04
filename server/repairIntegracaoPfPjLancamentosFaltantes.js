/**
 * Reparo: recria lançamentos PJ/PF ausentes no JSON quando a operação está ok no histórico.
 * (Ex.: reload com flush sobrescreveu o estado após confirmar integração.)
 *
 * Uso:
 *   node server/repairIntegracaoPfPjLancamentosFaltantes.js <email-pj> --dry-run
 *   node server/repairIntegracaoPfPjLancamentosFaltantes.js <email-pj>
 */
import { config } from 'dotenv';
config();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, pool } from './db.js';
import { normalizeTipoPerfil } from './profileTipo.js';
import {
  appendLancamentoToEstado,
  collectAllLancamentos,
  prepareEstadoForWrite,
  profileForPf,
  profileForPj,
  resolveEmpresaAtiva,
} from './integracaoPfPj/estadoMerge.js';
import { rebuildIntegracaoLancamentosForOperacao } from './integracaoPfPj/operacaoWriter.js';
import { reaisFromCentavos } from './utils/money.js';
import {
  validateLancamentoPfIntegracao,
  validateLancamentoPjIntegracao,
} from './integracaoPfPj/lancamentoPfPj.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(__dirname, 'backups');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const email = args.find((a) => !a.startsWith('--'))?.trim().toLowerCase();

if (!email) {
  console.error('Uso: node server/repairIntegracaoPfPjLancamentosFaltantes.js <email-pj> [--dry-run]');
  process.exit(1);
}

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function nextCodigo(lancamentos) {
  const nums = (lancamentos || [])
    .map((l) => Number(l.codigo))
    .filter((n) => Number.isFinite(n) && n > 0);
  return nums.length ? Math.max(...nums) + 1 : 1;
}

function hasLancamentoId(dados, id) {
  return collectAllLancamentos(dados).some((l) => String(l.id) === String(id));
}

function syncValoresIntegracao(dados, ops, profile) {
  const prepared = prepareEstadoForWrite(dados, profile);
  const byLancId = new Map();
  for (const op of ops) {
    byLancId.set(String(op.lancamento_pj_id), op);
    byLancId.set(String(op.lancamento_pf_id), op);
  }
  let corrigidos = 0;
  const empresas = prepared.empresas.map((emp) => {
    const lancamentos = (emp.lancamentos || []).map((l) => {
      const op = byLancId.get(String(l.id));
      if (!op || String(l.source || '') !== 'integracao_pf_pj') return l;
      const esperado = reaisFromCentavos(Math.round(Number(op.valor_centavos)));
      if (Math.abs(Number(l.valor) - esperado) < 0.005) return l;
      corrigidos += 1;
      console.log(`  ~ valor ${l.valor} → ${esperado} (${l.historico})`);
      return { ...l, valor: esperado };
    });
    return { ...emp, lancamentos };
  });
  return { dados: { ...prepared, empresas }, corrigidos };
}

async function main() {
  const { rows: users } = await query(
    `SELECT id, email, nome, nome_perfil, tipo_perfil FROM usuarios WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  if (!users.length) {
    console.error(`Usuário não encontrado: ${email}`);
    process.exit(1);
  }

  const pjUser = users[0];
  if (normalizeTipoPerfil(pjUser.tipo_perfil) !== 'juridica') {
    console.error('Informe o e-mail da conta PJ.');
    process.exit(1);
  }

  const { rows: opRows } = await query(
    `SELECT o.*, v.usuario_pj_id, v.usuario_pf_id, v.nome_pf
     FROM integracao_pf_pj_operacoes o
     JOIN integracao_pf_pj_vinculo v ON v.id = o.vinculo_id
     WHERE v.usuario_pj_id = $1 AND o.status = 'ok'
     ORDER BY o.created_at`,
    [pjUser.id]
  );

  if (!opRows.length) {
    console.log('Nenhuma operação ok para este PJ.');
    await pool.end();
    return;
  }

  const { rows: estadoPjRows } = await query(
    'SELECT dados FROM estados WHERE usuario_id = $1',
    [pjUser.id]
  );
  if (!estadoPjRows.length) {
    console.error('Estado PJ não encontrado.');
    process.exit(1);
  }

  const pjProfile = profileForPj(pjUser);
  let dadosPj = estadoPjRows[0].dados;
  const nomePj = pjUser.nome_perfil || pjUser.nome || 'Empresa PJ';

  let inseridosPj = 0;
  let inseridosPf = 0;

  const { dados: dadosPjSync, corrigidos: corrPj } = syncValoresIntegracao(
    estadoPjRows[0].dados,
    opRows,
    pjProfile
  );
  if (corrPj > 0) {
    dadosPj = dadosPjSync;
    console.log(`Valores PJ corrigidos (centavos): ${corrPj}`);
  }

  for (const op of opRows) {
    const faltaPj = !hasLancamentoId(dadosPj, op.lancamento_pj_id);
    if (!faltaPj) continue;

    const { rows: pfRows } = await query(
      'SELECT id, email, nome, nome_perfil, tipo_perfil FROM usuarios WHERE id = $1',
      [op.usuario_pf_id]
    );
    const pfUser = pfRows[0];
    if (!pfUser) {
      console.warn(`PF ${op.usuario_pf_id} não encontrada — operação ${op.id} ignorada.`);
      continue;
    }

    const { rows: estadoPfRows } = await query(
      'SELECT dados FROM estados WHERE usuario_id = $1',
      [op.usuario_pf_id]
    );
    if (!estadoPfRows.length) continue;

    const pfProfile = profileForPf(pfUser, op.nome_pf);
    let dadosPf = estadoPfRows[0].dados;

    const preparedPj = prepareEstadoForWrite(dadosPj, pjProfile);
    const preparedPf = prepareEstadoForWrite(dadosPf, pfProfile);
    const empPj = resolveEmpresaAtiva(preparedPj).empresa;
    const empPf = resolveEmpresaAtiva(preparedPf).empresa;

    const vinculo = {
      id: op.vinculo_id,
      nome_pf: op.nome_pf,
      usuario_pf_id: op.usuario_pf_id,
    };

    const { lancPj, lancPf } = rebuildIntegracaoLancamentosForOperacao(op, empPj, empPf, {
      vinculo,
      nomePj,
      usuarioPjId: pjUser.id,
    });

    lancPj.codigo = nextCodigo(collectAllLancamentos(preparedPj));
    lancPf.codigo = nextCodigo(collectAllLancamentos(preparedPf));

    const errosPj = validateLancamentoPjIntegracao(lancPj, empPj);
    const errosPf = validateLancamentoPfIntegracao(lancPf, empPf);
    if (errosPj.length || errosPf.length) {
      console.warn(`Operação ${op.id}: validação falhou PJ=[${errosPj}] PF=[${errosPf}]`);
      continue;
    }

    console.log(`  + PJ ${lancPj.historico} (${op.lancamento_pj_id})`);
    dadosPj = appendLancamentoToEstado(dadosPj, lancPj, pjProfile);
    inseridosPj += 1;

    if (!hasLancamentoId(dadosPf, op.lancamento_pf_id)) {
      console.log(`  + PF ${lancPf.historico} (${op.lancamento_pf_id})`);
      dadosPf = appendLancamentoToEstado(dadosPf, lancPf, pfProfile);
      inseridosPf += 1;
      if (!dryRun) {
        await query(
          'UPDATE estados SET dados = $1, updated_at = NOW() WHERE usuario_id = $2',
          [JSON.stringify(prepareEstadoForWrite(dadosPf, pfProfile)), op.usuario_pf_id]
        );
      }
    }
  }

  console.log(`Operações ok: ${opRows.length}`);
  console.log(`Lançamentos PJ recriados: ${inseridosPj}`);
  console.log(`Lançamentos PF recriados: ${inseridosPf}`);

  if (!inseridosPj && corrPj === 0) {
    console.log('Nada a reparar — lançamentos e valores PJ já estão corretos.');
    await pool.end();
    return;
  }

  if (!inseridosPj && corrPj > 0 && dryRun) {
    console.log('[dry-run] Apenas correção de valores seria aplicada.');
    await pool.end();
    return;
  }

  if (!inseridosPj && corrPj > 0) {
    ensureBackupDir();
    const backupPath = path.join(
      BACKUP_DIR,
      `pj-valores-${pjUser.id}-${Date.now()}.json`
    );
    fs.writeFileSync(backupPath, JSON.stringify(estadoPjRows[0].dados, null, 2));
    await query(
      'UPDATE estados SET dados = $1, updated_at = NOW() WHERE usuario_id = $2',
      [JSON.stringify(prepareEstadoForWrite(dadosPj, pjProfile)), pjUser.id]
    );
    console.log('Valores PJ corrigidos no estado.');
    await pool.end();
    return;
  }

  if (dryRun) {
    console.log('[dry-run] Nenhuma alteração gravada.');
    await pool.end();
    return;
  }

  ensureBackupDir();
  const backupPath = path.join(
    BACKUP_DIR,
    `pj-lanc-faltantes-${pjUser.id}-${Date.now()}.json`
  );
  fs.writeFileSync(backupPath, JSON.stringify(estadoPjRows[0].dados, null, 2));
  console.log(`Backup PJ: ${backupPath}`);

  await query(
    'UPDATE estados SET dados = $1, updated_at = NOW() WHERE usuario_id = $2',
    [JSON.stringify(prepareEstadoForWrite(dadosPj, pjProfile)), pjUser.id]
  );
  console.log('Estado PJ atualizado.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  pool.end().finally(() => process.exit(1));
});
