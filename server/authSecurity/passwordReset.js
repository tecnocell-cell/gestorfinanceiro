import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { query } from '../db.js';
import { sendPasswordResetEmail } from '../notify.js';
import { PASSWORD_RESET_TTL_MIN } from './constants.js';

function generateToken() {
  return randomBytes(32).toString('hex');
}

export async function requestPasswordReset(email) {
  const normalized = String(email || '').toLowerCase().trim();
  const generic = {
    ok: true,
    message: 'Se o e-mail existir em nossa base, enviaremos instruções de recuperação.',
  };

  if (!normalized) return generic;

  const { rows } = await query(
    `SELECT id, email, nome, ativo FROM usuarios WHERE email = $1 AND role = 'user'`,
    [normalized]
  );
  const user = rows[0];
  if (!user) return generic;

  const token = generateToken();
  const hash = await bcrypt.hash(token, 10);

  await query(
    `UPDATE password_resets SET used_at = NOW()
     WHERE usuario_id = $1 AND used_at IS NULL`,
    [user.id]
  );

  await query(
    `INSERT INTO password_resets (usuario_id, token, expires_at)
     VALUES ($1, $2, NOW() + ($3::text || ' minutes')::interval)`,
    [user.id, hash, String(PASSWORD_RESET_TTL_MIN)]
  );

  await sendPasswordResetEmail(user.email, user.nome, token);

  const payload = { ...generic };
  if (process.env.NODE_ENV !== 'production') {
    payload.dev_token = token;
  }
  return payload;
}

export async function resetPasswordWithToken(token, novaSenha) {
  if (!token || String(token).length < 20) {
    return { ok: false, error: 'Token inválido.' };
  }
  if (!novaSenha || String(novaSenha).length < 6) {
    return { ok: false, error: 'Senha mínima: 6 caracteres.' };
  }

  const { rows } = await query(
    `SELECT pr.id, pr.usuario_id, pr.token, pr.expires_at, pr.used_at
     FROM password_resets pr
     WHERE pr.used_at IS NULL AND pr.expires_at > NOW()
     ORDER BY pr.created_at DESC
     LIMIT 20`
  );

  let match = null;
  for (const row of rows) {
    if (await bcrypt.compare(String(token), row.token)) {
      match = row;
      break;
    }
  }

  if (!match) {
    return { ok: false, error: 'Token inválido ou expirado.' };
  }

  const hash = await bcrypt.hash(novaSenha, 12);
  await query('UPDATE usuarios SET senha_hash = $1, updated_at = NOW() WHERE id = $2', [
    hash,
    match.usuario_id,
  ]);
  await query('UPDATE password_resets SET used_at = NOW() WHERE id = $1', [match.id]);

  const { resetLoginAttempts } = await import('./bruteForce.js');
  await resetLoginAttempts(match.usuario_id);

  return { ok: true };
}
