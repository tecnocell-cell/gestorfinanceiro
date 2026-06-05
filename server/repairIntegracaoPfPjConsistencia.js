/**
 * Reparo bilateral PJ↔PF — alinha valores ao valor_centavos da operação (fonte da verdade).
 *
 * Uso:
 *   node server/repairIntegracaoPfPjConsistencia.js --email-pj <email> --dry-run
 *   node server/repairIntegracaoPfPjConsistencia.js --email-pf <email>
 */
import { config } from 'dotenv';
config();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, pool } from './db.js';
import {
  appendLancamentoToEstado,
  collectAllLancamentos,
  prepareEstadoForWrite,
  profileForPf,
  profileForPj,
  resolveEmpresaAtiva,
} from './integracaoPfPj/estadoMerge.js';
import { reaisFromCentavos } from './utils/money.js';
import { rebuildIntegracaoLancamentosForOperacao } from './integracaoPfPj/operacaoWriter.js';
import {
  validateLancamentoPfIntegracao,
  validateLancamentoPjIntegracao,
} from './integracaoPfPj/lancamentoPfPj.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(__dirname, 'backups');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const email =
  (args.includes('--email-pj') ? args[args.indexOf('--email-pj') + 1] : null) ||
  (args.includes('--email-pf') ? args[args.indexOf('--email-pf') + 1] : null) ||
  args.find((a) => !a.startsWith('--'));

function syncValores(dados, ops, lado, profile) {
  const prepared = prepareEstadoForWrite(dados, profile);
  const byId = new Map();
  for (const op of ops) {
    const id = lado === 'pj' ? op.lancamento_pj_id : op.lancamento_pf_id;
    if (id) byId.set(String(id), op);
  }
  let fixes = 0;
  const empresas = prepared.empresas.map((emp) => ({
    ...emp,
    lancamentos: (emp.lancamentos || []).map((l) => {
      const op = byId.get(String(l.id));
      if (!op || l.source !== 'integracao_pf_pj') return l;
      const esperado = reaisFromCentavos(Math.trunc(Number(op.valor_centavos)));
      if (Math.abs(Number(l.valor) - esperado) < 0.005) return l;
      fixes += 1;
      console.log(`  ~ ${lado.toUpperCase()} ${l.valor} → ${esperado} (op ${op.id})`);
      return { ...l, valor: esperado };
    }),
  }));
  return { dados: { ...prepared, empresas }, fixes };
}

function hasLanc(dados, id) {
  return collectAllLancamentos(dados).some((l) => String(l.id) === String(id));
}

function nextCodigo(lancamentos) {
  const nums = (lancamentos || [])
    .map((l) => Number(l.codigo))
    .filter((n) => Number.isFinite(n) && n > 0);
  return nums.length ? Math.max(...nums) + 1 : 1;
}

async function main() {
  if (!email) {
    console.error('Uso: node server/repairIntegracaoPfPjConsistencia.js --email-pj <email> [--dry-run]');
    process.exit(1);
  }

  const { rows: users } = await query(
    `SELECT id, email, nome, nome_perfil, tipo_perfil FROM usuarios WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  if (!users.length) {
    console.error('Usuário não encontrado');
    process.exit(1);
  }

  const byPf = users[0].tipo_perfil === 'fisica';
  const { rows: vinc } = await query(
    `SELECT v.* FROM integracao_pf_pj_vinculo v
     WHERE ${byPf ? 'v.usuario_pf_id' : 'v.usuario_pj_id'} = $1`,
    [users[0].id]
  );
  if (!vinc.length) {
    console.log('Sem vínculo.');
    await pool.end();
    return;
  }

  const v = vinc[0];
  const { rows: pjUser } = await query('SELECT * FROM usuarios WHERE id = $1', [v.usuario_pj_id]);
  const { rows: pfUser } = await query('SELECT * FROM usuarios WHERE id = $1', [v.usuario_pf_id]);
  const pjProfile = profileForPj(pjUser[0]);
  const pfProfile = profileForPf(pfUser[0], v.nome_pf);
  const nomePj = pjUser[0].nome_perfil || pjUser[0].nome || 'Empresa PJ';

  const { rows: ops } = await query(
    `SELECT o.*, v.nome_pf FROM integracao_pf_pj_operacoes o
     JOIN integracao_pf_pj_vinculo v ON v.id = o.vinculo_id
     WHERE o.vinculo_id = $1 AND o.status = 'ok' ORDER BY o.created_at`,
    [v.id]
  );

  const [estPj, estPf] = await Promise.all([
    query('SELECT dados FROM estados WHERE usuario_id = $1', [v.usuario_pj_id]),
    query('SELECT dados FROM estados WHERE usuario_id = $1', [v.usuario_pf_id]),
  ]);

  let dadosPj = estPj.rows[0]?.dados;
  let dadosPf = estPf.rows[0]?.dados;
  let recreated = 0;

  for (const op of ops) {
    const faltaPj = !hasLanc(dadosPj, op.lancamento_pj_id);
    const faltaPf = !hasLanc(dadosPf, op.lancamento_pf_id);
    if (!faltaPj && !faltaPf) continue;

    const preparedPj = prepareEstadoForWrite(dadosPj, pjProfile);
    const preparedPf = prepareEstadoForWrite(dadosPf, pfProfile);
    const empPj = resolveEmpresaAtiva(preparedPj).empresa;
    const empPf = resolveEmpresaAtiva(preparedPf).empresa;
    const vinculo = { id: v.id, nome_pf: op.nome_pf, usuario_pf_id: v.usuario_pf_id };

    const { lancPj, lancPf } = rebuildIntegracaoLancamentosForOperacao(op, empPj, empPf, {
      vinculo,
      nomePj,
      usuarioPjId: v.usuario_pj_id,
    });
    lancPj.codigo = nextCodigo(collectAllLancamentos(preparedPj));
    lancPf.codigo = nextCodigo(collectAllLancamentos(preparedPf));

    if (faltaPj && !validateLancamentoPjIntegracao(lancPj, empPj).length) {
      console.log(`  + recriar PJ op ${op.id}`);
      if (!dryRun) dadosPj = appendLancamentoToEstado(dadosPj, lancPj, pjProfile);
      recreated += 1;
    }
    if (faltaPf && !validateLancamentoPfIntegracao(lancPf, empPf).length) {
      console.log(`  + recriar PF op ${op.id}`);
      if (!dryRun) dadosPf = appendLancamentoToEstado(dadosPf, lancPf, pfProfile);
      recreated += 1;
    }
  }

  const syncPj = syncValores(dadosPj, ops, 'pj', pjProfile);
  const syncPf = syncValores(dadosPf, ops, 'pf', pfProfile);
  dadosPj = syncPj.dados;
  dadosPf = syncPf.dados;

  console.log(`\nRecriados: ${recreated}  Fixes PJ: ${syncPj.fixes}  Fixes PF: ${syncPf.fixes}  dry-run: ${dryRun}`);

  if (dryRun || (recreated === 0 && syncPj.fixes === 0 && syncPf.fixes === 0)) {
    await pool.end();
    return;
  }

  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const ts = Date.now();
  fs.writeFileSync(
    path.join(BACKUP_DIR, `repair-consistencia-${ts}.json`),
    JSON.stringify({ pj: estPj.rows[0]?.dados, pf: estPf.rows[0]?.dados }, null, 2)
  );

  await query('UPDATE estados SET dados = $1, updated_at = NOW() WHERE usuario_id = $2', [
    JSON.stringify(dadosPj),
    v.usuario_pj_id,
  ]);
  await query('UPDATE estados SET dados = $1, updated_at = NOW() WHERE usuario_id = $2', [
    JSON.stringify(dadosPf),
    v.usuario_pf_id,
  ]);

  console.log('✓ Reparo aplicado. Backup em server/backups/');
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
