import { query } from '../db.js';

const TIPOS = new Set(['bug', 'duvida', 'sugestao', 'elogio']);
const STATUS = new Set(['aberto', 'em_analise', 'resolvido', 'arquivado']);

export function normalizeFeedbackTipo(raw) {
  const t = String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (t === 'duvida' || t === 'dúvida') return 'duvida';
  return TIPOS.has(t) ? t : null;
}

export async function createFeedback({ usuarioId, tela, tipo, mensagem }) {
  const tipoNorm = normalizeFeedbackTipo(tipo);
  if (!tipoNorm) throw new Error('Tipo de feedback inválido.');
  const msg = String(mensagem || '').trim();
  if (msg.length < 3) throw new Error('Mensagem muito curta.');
  const { rows } = await query(
    `INSERT INTO feedback_beta (usuario_id, tela, tipo, mensagem)
     VALUES ($1, $2, $3, $4)
     RETURNING id, usuario_id, tela, tipo, mensagem, status, created_at`,
    [usuarioId, String(tela || '').slice(0, 120), tipoNorm, msg.slice(0, 8000)]
  );
  return rows[0];
}

export async function listFeedback({ status, tipo, limit = 200 } = {}) {
  const clauses = [];
  const params = [];
  let n = 1;
  if (status) {
    clauses.push(`f.status = $${n++}`);
    params.push(status);
  }
  if (tipo) {
    clauses.push(`f.tipo = $${n++}`);
    params.push(tipo);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  params.push(Math.min(Number(limit) || 200, 500));
  const { rows } = await query(
    `SELECT f.id, f.usuario_id, f.tela, f.tipo, f.mensagem, f.status, f.created_at,
            u.nome AS usuario_nome, u.email AS usuario_email, u.tipo_perfil
     FROM feedback_beta f
     JOIN usuarios u ON u.id = f.usuario_id
     ${where}
     ORDER BY f.created_at DESC
     LIMIT $${n}`,
    params
  );
  return rows;
}

export async function patchFeedbackStatus(id, status) {
  if (!STATUS.has(status)) throw new Error('Status inválido.');
  const { rows } = await query(
    `UPDATE feedback_beta SET status = $2 WHERE id = $1
     RETURNING id, usuario_id, tela, tipo, mensagem, status, created_at`,
    [id, status]
  );
  return rows[0] || null;
}

export async function getBetaAdminSummary() {
  const { rows: counts } = await query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE tipo = 'bug' AND status IN ('aberto', 'em_analise'))::int AS bugs_abertos,
       COUNT(*) FILTER (WHERE tipo = 'sugestao')::int AS sugestoes,
       COUNT(*) FILTER (WHERE status = 'aberto')::int AS abertos
     FROM feedback_beta`
  );
  const { rows: betaUsers } = await query(
    `SELECT COUNT(DISTINCT usuario_id)::int AS usuarios_com_feedback
     FROM feedback_beta`
  );
  const { rows: activeBeta } = await query(
    `SELECT COUNT(*)::int AS ativos
     FROM usuarios
     WHERE role = 'user' AND ativo = true`
  );
  return {
    feedback: counts[0] || { total: 0, bugs_abertos: 0, sugestoes: 0, abertos: 0 },
    usuarios_beta_ativos: activeBeta[0]?.ativos || 0,
    usuarios_com_feedback: betaUsers[0]?.usuarios_com_feedback || 0,
  };
}
