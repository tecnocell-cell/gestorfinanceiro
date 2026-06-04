/**
 * Logs operacionais de cobrança — Etapa 7.5 (não quebra se tabela ausente)
 */
import { query } from '../db.js';

export const BILLING_OPS_TYPES = {
  CHECKOUT_CRIADO: 'checkout_criado',
  WEBHOOK_RECEBIDO: 'webhook_recebido',
  ASSINATURA_ATIVADA: 'assinatura_ativada',
  PAGAMENTO_FALHA: 'pagamento_falha',
  CANCELAMENTO: 'cancelamento',
  TROCA_PLANO: 'troca_plano',
};

export async function logBillingOp(tipo, { usuarioId = null, faturaId = null, detalhes = {} } = {}) {
  const payload = { tipo, usuarioId, faturaId, ...detalhes };
  console.log('[billing/ops]', JSON.stringify(payload));
  try {
    await query(
      `INSERT INTO billing_ops_log (tipo, usuario_id, fatura_id, detalhes)
       VALUES ($1, $2, $3, $4)`,
      [tipo, usuarioId, faturaId, JSON.stringify(detalhes)]
    );
  } catch (err) {
    console.warn('[billing/ops] persist:', err.message);
  }
}

export async function listBillingOpsLog({ limit = 50, tipos = null } = {}) {
  const params = [limit];
  let where = '';
  if (tipos?.length) {
    where = `WHERE tipo = ANY($2)`;
    params.push(tipos);
  }
  const { rows } = await query(
    `SELECT id, tipo, usuario_id, fatura_id, detalhes, created_at
     FROM billing_ops_log
     ${where}
     ORDER BY created_at DESC
     LIMIT $1`,
    params
  );
  return rows;
}
