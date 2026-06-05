/**
 * Auditoria de consistência PJ↔PF — valores e lançamentos pareados.
 *
 * Uso:
 *   node server/auditIntegracaoPfPjConsistencia.js <email-pj>
 *   node server/auditIntegracaoPfPjConsistencia.js --email-pf <email>
 */
import { config } from 'dotenv';
config();

import { query, pool } from './db.js';
import { collectAllLancamentos } from './integracaoPfPj/estadoMerge.js';
import { reaisFromCentavos, reaisToCentavos } from './utils/money.js';

const args = process.argv.slice(2);
const emailPfFlag = args.indexOf('--email-pf');
const email =
  emailPfFlag >= 0 ? args[emailPfFlag + 1] : args.find((a) => !a.startsWith('--'));

if (!email) {
  console.error('Uso: node server/auditIntegracaoPfPjConsistencia.js <email-pj>');
  console.error('     node server/auditIntegracaoPfPjConsistencia.js --email-pf <email>');
  process.exit(1);
}

function findLanc(dados, id) {
  if (!id || !dados) return null;
  return collectAllLancamentos(dados).find((l) => String(l.id) === String(id)) || null;
}

function cents(lanc) {
  if (lanc?.valor == null) return null;
  return reaisToCentavos(lanc.valor);
}

async function main() {
  const { rows: users } = await query(
    `SELECT id, email, tipo_perfil FROM usuarios WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  if (!users.length) {
    console.error('Usuário não encontrado:', email);
    process.exit(1);
  }
  const u = users[0];
  const isPf = u.tipo_perfil === 'fisica';

  const { rows: vinc } = await query(
    `SELECT v.*, pj.email AS email_pj, pf.email AS email_pf
     FROM integracao_pf_pj_vinculo v
     JOIN usuarios pj ON pj.id = v.usuario_pj_id
     JOIN usuarios pf ON pf.id = v.usuario_pf_id
     WHERE ${isPf ? 'v.usuario_pf_id' : 'v.usuario_pj_id'} = $1`,
    [u.id]
  );
  if (!vinc.length) {
    console.log('Nenhum vínculo PF/PJ.');
    await pool.end();
    return;
  }

  const v = vinc[0];
  const [estPj, estPf, ops] = await Promise.all([
    query('SELECT dados FROM estados WHERE usuario_id = $1', [v.usuario_pj_id]),
    query('SELECT dados FROM estados WHERE usuario_id = $1', [v.usuario_pf_id]),
    query(
      `SELECT o.* FROM integracao_pf_pj_operacoes o
       WHERE o.vinculo_id = $1 AND o.status = 'ok'
       ORDER BY o.created_at`,
      [v.id]
    ),
  ]);

  const dadosPj = estPj.rows[0]?.dados;
  const dadosPf = estPf.rows[0]?.dados;
  const allPjInts = collectAllLancamentos(dadosPj).filter((l) => l.source === 'integracao_pf_pj');
  const allPfInts = collectAllLancamentos(dadosPf).filter((l) => l.source === 'integracao_pf_pj');
  const opIds = new Set(ops.rows.map((o) => String(o.id)));

  console.log(`\n=== Auditoria integração PF/PJ ===`);
  console.log(`PJ: ${v.email_pj}  PF: ${v.email_pf}`);
  console.log(`Operações ok: ${ops.rows.length}\n`);

  const issues = [];

  for (const op of ops.rows) {
    const lPj = findLanc(dadosPj, op.lancamento_pj_id);
    const lPf = findLanc(dadosPf, op.lancamento_pf_id);
    const centsOp = Math.trunc(Number(op.valor_centavos));
    const centsPj = cents(lPj);
    const centsPf = cents(lPf);

    const diffPj = centsPj != null ? centsOp - centsPj : null;
    const diffPf = centsPf != null ? centsOp - centsPf : null;
    const row = {
      operacao_id: op.id,
      tipo: op.tipo_operacao,
      valor_centavos_operacao: centsOp,
      valor_operacao: reaisFromCentavos(centsOp),
      valor_centavos_pj: centsPj,
      valor_centavos_pf: centsPf,
      valor_pj: lPj ? lPj.valor : null,
      valor_pf: lPf ? lPf.valor : null,
      diff_centavos_pj: diffPj,
      diff_centavos_pf: diffPf,
      rollback_possivel: !!(lPj && lPf),
      lancamento_pj: lPj ? `${lPj.valor} (${lPj.historico})` : 'AUSENTE',
      lancamento_pf: lPf ? `${lPf.valor} (${lPf.historico})` : 'AUSENTE',
      divergencia_valor: null,
      divergencia_conta: null,
      bug_float_14999: lPj?.valor === 14999.99 || lPf?.valor === 14999.99,
    };

    if (!lPj || !lPf) {
      row.orphan = !lPj && !lPf ? 'ambos' : !lPj ? 'pj' : 'pf';
      issues.push(row);
      continue;
    }

    if (centsPj !== centsOp || centsPf !== centsOp || centsPj !== centsPf) {
      row.divergencia_valor = `op=${centsOp} pj=${centsPj} pf=${centsPf}`;
      issues.push(row);
    }

    if (lPj.integracaoPfPj?.operacaoId !== op.id || lPf.integracaoPfPj?.operacaoId !== op.id) {
      row.divergencia_conta = 'operacao_id divergente nos lançamentos';
      issues.push(row);
    }
  }

  for (const l of [...allPjInts, ...allPfInts]) {
    const opId = l.integracaoPfPj?.operacaoId;
    if (opId && !opIds.has(String(opId))) {
      issues.push({
        operacao_id: opId || l.id,
        valor_operacao: l.valor,
        lancamento_pj: l.integracaoPfPj?.lado === 'pj' ? l.valor : '—',
        lancamento_pf: l.integracaoPfPj?.lado === 'pf' ? l.valor : '—',
        orphan: `lançamento sem operação ok (${l.integracaoPfPj?.lado})`,
      });
    }
  }

  if (!issues.length) {
    console.log('✓ Nenhuma inconsistência encontrada.');
  } else {
    console.log(`⚠ ${issues.length} problema(s):\n`);
    for (const i of issues) {
      console.log(JSON.stringify(i, null, 2));
      console.log('---');
    }
  }

  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
