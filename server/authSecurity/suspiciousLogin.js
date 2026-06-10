import { query } from '../db.js';
import { getLastSuccessfulLogin } from './loginAudit.js';

function suspiciousLoginDisabled() {
  const v = String(process.env.SUSPICIOUS_LOGIN || '').toLowerCase();
  return v === 'false' || v === '0' || v === 'off';
}

function requireOtpAlways() {
  return String(process.env.REQUIRE_OTP_LOGIN || '').toLowerCase() === 'true';
}

/**
 * Marca login como suspeito quando há combinação de risco (não só IP ou UA novo isolado).
 * Se REQUIRE_OTP_LOGIN=true, exige OTP em todo login independente de risco.
 */
export async function assessSuspiciousLogin(userId, ip, userAgent) {
  if (suspiciousLoginDisabled()) {
    return { suspicious: false, reasons: [] };
  }

  if (requireOtpAlways()) {
    return { suspicious: true, reasons: ['verificacao_obrigatoria'] };
  }

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

  // Exige OTP: muitas falhas recentes OU IP + UA diferentes juntos (não só um sinal isolado)
  const suspicious =
    reasons.includes('tentativas_recentes') ||
    (reasons.includes('ip_novo') && reasons.includes('user_agent_novo'));

  return { suspicious, reasons };
}
