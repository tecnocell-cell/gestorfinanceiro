/**
 * Corrige integracao_pf_pj_operacoes.valor_centavos quando diverge dos lançamentos PJ/PF.
 *
 * Uso:
 *   node server/repairIntegracaoPfPjValores.js <email-pj> --dry-run
 *   node server/repairIntegracaoPfPjValores.js <email-pj>
 */
import { config } from 'dotenv';
config();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, pool } from './db.js';
import { collectAllLancamentos } from './integracaoPfPj/estadoMerge.js';
import { reaisFromCentavos, reaisToCentavos } from './utils/money.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(__dirname, 'backups');

function findLancamento(dados, id) {
  if (!id) return null;
  const all = collectAllLancamentos(dados);
  return all.find((l) => String(l.id) === String(id)) || null;
}

function centsFromLanc(lanc) {
  if (!lanc || lanc.valor == null) return null;
  return reaisToCentavos(lanc.valor);
}

async function main() {
  const email = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');
  if (!email) {
    console.error('Uso: node server/repairIntegracaoPfPjValores.js <email-pj> [--dry-run]');
    process.exit(1);
  }

  const { rows: users } = await query(
    `SELECT id, email, tipo_perfil FROM usuarios WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  if (!users.length) {
    console.error('Usuário não encontrado:', email);
    process.exit(1);
  }
  const pj = users[0];
  if (pj.tipo_perfil !== 'juridica') {
    console.error('Informe o e-mail da conta PJ.');
    process.exit(1);
  }

  const { rows: vincRows } = await query(
    `SELECT id, usuario_pf_id FROM integracao_pf_pj_vinculo WHERE usuario_pj_id = $1`,
    [pj.id]
  );
  if (!vincRows.length) {
    console.log('Nenhum vínculo PF/PJ.');
    await pool.end();
    return;
  }

  const pfId = vincRows[0].usuario_pf_id;
  const [estPj, estPf, ops] = await Promise.all([
    query('SELECT dados FROM estados WHERE usuario_id = $1', [pj.id]),
    query('SELECT dados FROM estados WHERE usuario_id = $1', [pfId]),
    query(
      `SELECT o.id, o.valor_centavos, o.lancamento_pj_id, o.lancamento_pf_id, o.tipo_operacao, o.historico, o.status
       FROM integracao_pf_pj_operacoes o
       JOIN integracao_pf_pj_vinculo v ON v.id = o.vinculo_id
       WHERE v.usuario_pj_id = $1 AND o.status = 'ok'
       ORDER BY o.created_at DESC`,
      [pj.id]
    ),
  ]);

  const dadosPj = estPj.rows[0]?.dados;
  const dadosPf = estPf.rows[0]?.dados;
  const divergentes = [];

  for (const op of ops.rows) {
    const centsOp = Math.trunc(Number(op.valor_centavos));
    const lPj = findLancamento(dadosPj, op.lancamento_pj_id);
    const lPf = findLancamento(dadosPf, op.lancamento_pf_id);
    const centsPj = centsFromLanc(lPj);
    const centsPf = centsFromLanc(lPf);

    let esperado = null;
    if (centsPj != null && centsPf != null) {
      if (centsPj !== centsPf) {
        console.warn(
          `  ⚠ op ${op.id}: lançamentos PJ (${reaisFromCentavos(centsPj)}) ≠ PF (${reaisFromCentavos(centsPf)})`
        );
        esperado = Math.max(centsPj, centsPf);
      } else {
        esperado = centsPj;
      }
    } else if (centsPj != null) esperado = centsPj;
    else if (centsPf != null) esperado = centsPf;

    if (esperado == null) continue;
    if (centsOp !== esperado) {
      divergentes.push({
        op,
        centsOp,
        esperado,
        reaisOp: reaisFromCentavos(centsOp),
        reaisEsp: reaisFromCentavos(esperado),
        lPj,
        lPf,
      });
    }
  }

  console.log(`\nOperações ok: ${ops.rows.length}`);
  console.log(`Divergentes (valor_centavos ≠ lançamentos): ${divergentes.length}\n`);

  for (const d of divergentes) {
    console.log(`  op ${d.op.id.slice(0, 8)}… ${d.op.tipo_operacao}`);
    console.log(`    DB valor_centavos: ${d.centsOp} → R$ ${d.reaisOp}`);
    console.log(`    Lançamentos:       ${d.esperado} → R$ ${d.reaisEsp}`);
    if (d.lPj) console.log(`    PJ: ${d.lPj.historico?.slice(0, 50)}`);
    if (d.lPf) console.log(`    PF: ${d.lPf.historico?.slice(0, 50)}`);
  }

  if (!divergentes.length) {
    console.log('\nNada a corrigir.');
    await pool.end();
    return;
  }

  if (dryRun) {
    console.log('\n--dry-run: nenhuma gravação.');
    await pool.end();
    return;
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `integracao-valores-${pj.id}-${ts}.json`);
  fs.writeFileSync(
    backupFile,
    JSON.stringify({ operacoes: divergentes.map((d) => d.op) }, null, 2)
  );
  console.log('\nBackup:', backupFile);

  for (const d of divergentes) {
    await query('UPDATE integracao_pf_pj_operacoes SET valor_centavos = $2 WHERE id = $1', [
      d.op.id,
      d.esperado,
    ]);
  }

  console.log(`Atualizadas ${divergentes.length} operação(ões).`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
