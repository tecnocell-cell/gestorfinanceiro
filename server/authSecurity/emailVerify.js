import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { query } from '../db.js';
import { sendVerificationEmailLink } from '../notify.js';
import { EMAIL_VERIFY_TOKEN_TTL_HOURS } from './constants.js';

function generateToken() {
  return randomBytes(32).toString('hex');
}

export async function createAndSendEmailVerificationToken(usuarioId, { email, nome }) {
  const token = generateToken();
  const hash = await bcrypt.hash(token, 10);

  await query(
    `UPDATE verificacoes SET usado = true
     WHERE usuario_id = $1 AND canal IN ('email', 'email_link') AND usado = false`,
    [usuarioId]
  );

  await query(
    `INSERT INTO verificacoes (usuario_id, canal, codigo_hash, expires_at)
     VALUES ($1, 'email_link', $2, NOW() + ($3::text || ' hours')::interval)`,
    [usuarioId, hash, String(EMAIL_VERIFY_TOKEN_TTL_HOURS)]
  );

  await sendVerificationEmailLink(email, nome, token);

  const payload = { ttl_hours: EMAIL_VERIFY_TOKEN_TTL_HOURS };
  if (process.env.NODE_ENV !== 'production') {
    payload.dev_token = token;
  }
  return payload;
}

export async function verifyEmailByToken(token) {
  if (!token || String(token).length < 20) {
    return { ok: false, error: 'Token inválido.' };
  }

  const { rows } = await query(
    `SELECT v.usuario_id, v.codigo_hash, v.expires_at, v.usado,
            u.email, u.nome, u.email_verificado
     FROM verificacoes v
     JOIN usuarios u ON u.id = v.usuario_id
     WHERE v.canal = 'email_link' AND v.usado = false
     ORDER BY v.created_at DESC
     LIMIT 50`
  );

  let match = null;
  for (const row of rows) {
    if (new Date(row.expires_at) < new Date()) continue;
    if (await bcrypt.compare(String(token), row.codigo_hash)) {
      match = row;
      break;
    }
  }

  if (!match) {
    return { ok: false, error: 'Token inválido ou expirado.' };
  }

  await query(
    `UPDATE verificacoes SET usado = true
     WHERE usuario_id = $1 AND canal = 'email_link' AND usado = false`,
    [match.usuario_id]
  );

  await query(
    `UPDATE usuarios
     SET email_verificado = true,
         email_verificado_em = NOW(),
         ativo = true,
         updated_at = NOW()
     WHERE id = $1`,
    [match.usuario_id]
  );

  return {
    ok: true,
    email: match.email,
    alreadyVerified: Boolean(match.email_verificado),
  };
}
