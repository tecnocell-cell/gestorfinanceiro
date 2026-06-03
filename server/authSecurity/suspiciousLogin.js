import { query } from '../db.js';
import { getLastSuccessfulLogin } from './loginAudit.js';

/**
 * Marca login como suspeito quando IP, user-agent ou tentativas recentes divergem.
 */
export async function assessSuspiciousLogin(userId, ip, userAgent) {
  const reasons = [];

  const { rows: failRows } = await query(
    `SELECT COUNT(*)::int AS n
     FROM login_audits
     WHERE usuario_id = $1
       AND sucesso = false
       AND created_at > NOW() - INTERVAL '30 minutes'`,
    [userId]
  );
  if (failRows[0]?.n >= 3) {
    reasons.push('tentativas_recentes');
  }

  const last = await getLastSuccessfulLogin(userId);
  if (last) {
    const ipNorm = String(ip || '').trim();
    const lastIp = String(last.ip || '').trim();
    if (ipNorm && lastIp && ipNorm !== lastIp) {
      reasons.push('ip_novo');
    }
    const uaNorm = String(userAgent || '').trim();
    const lastUa = String(last.user_agent || '').trim();
    if (uaNorm && lastUa && uaNorm !== lastUa) {
      reasons.push('user_agent_novo');
    }
  }

  return {
    suspicious: reasons.length > 0,
    reasons,
  };
}
