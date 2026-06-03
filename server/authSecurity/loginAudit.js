import { query } from '../db.js';

export async function recordLoginAudit({ usuarioId = null, ip, userAgent, sucesso }) {
  await query(
    `INSERT INTO login_audits (usuario_id, ip, user_agent, sucesso)
     VALUES ($1, $2, $3, $4)`,
    [usuarioId, ip || null, userAgent || null, Boolean(sucesso)]
  );
}

export async function getLastSuccessfulLogin(usuarioId) {
  const { rows } = await query(
    `SELECT ip, user_agent, created_at
     FROM login_audits
     WHERE usuario_id = $1 AND sucesso = true
     ORDER BY created_at DESC
     LIMIT 1`,
    [usuarioId]
  );
  return rows[0] || null;
}
