/**
 * Auditoria operacional — integração PF/PJ (preview, confirmar, rollback, repair).
 */
import { query } from '../db.js';

export const AUDIT_ACAO = {
  PREVIEW: 'preview',
  CONFIRMAR: 'confirmar',
  ROLLBACK: 'rollback',
  REPAIR: 'repair',
};

function runQuery(clientOrQuery, text, params) {
  if (clientOrQuery && typeof clientOrQuery.query === 'function') {
    return clientOrQuery.query(text, params);
  }
  return query(text, params);
}

/**
 * @param {import('pg').PoolClient|{query:Function}|null} clientOrQuery
 */
export async function insertIntegracaoAuditoria(clientOrQuery, {
  operacaoId = null,
  vinculoId,
  usuarioPjId,
  usuarioPfId,
  acao,
  tipoOperacao,
  valorCentavos,
  payload = {},
}) {
  if (!vinculoId || !usuarioPjId || !usuarioPfId || !acao || !tipoOperacao) {
    return;
  }
  const cents = Math.trunc(Number(valorCentavos));
  if (!Number.isFinite(cents) || cents <= 0) return;

  await runQuery(
    clientOrQuery,
    `INSERT INTO integracao_pf_pj_auditoria (
       operacao_id, vinculo_id, usuario_pj_id, usuario_pf_id,
       acao, tipo_operacao, valor_centavos, payload
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      operacaoId,
      vinculoId,
      usuarioPjId,
      usuarioPfId,
      acao,
      tipoOperacao,
      cents,
      JSON.stringify(payload ?? {}),
    ]
  );
}

function toIso(ts) {
  if (!ts) return null;
  if (ts instanceof Date) return ts.toISOString();
  return String(ts);
}

/** Anexa desfeitoEm (audit rollback) às operações listadas. */
export async function attachAuditoriaToOperacoes(operacoes, clientOrQuery = query) {
  const list = operacoes || [];
  const ids = list.map((o) => o.id).filter(Boolean);
  if (!ids.length) return list;

  const { rows } = await runQuery(
    clientOrQuery,
    `SELECT operacao_id, acao, created_at
     FROM integracao_pf_pj_auditoria
     WHERE operacao_id = ANY($1::uuid[])
       AND acao IN ('rollback', 'confirmar')
     ORDER BY created_at ASC`,
    [ids]
  );

  const rollbackByOp = new Map();
  const confirmByOp = new Map();
  for (const r of rows) {
    const id = String(r.operacao_id);
    const iso = toIso(r.created_at);
    if (r.acao === 'rollback') rollbackByOp.set(id, iso);
    if (r.acao === 'confirmar') confirmByOp.set(id, iso);
  }

  return list.map((op) => {
    const id = String(op.id);
    const criadoEm =
      op.createdAt instanceof Date
        ? op.createdAt.toISOString()
        : op.createdAt || confirmByOp.get(id) || null;
    return {
      ...op,
      criadoEm,
      confirmadoEm: confirmByOp.get(id) || criadoEm,
      desfeitoEm: op.status === 'rollback' ? rollbackByOp.get(id) || null : null,
    };
  });
}
