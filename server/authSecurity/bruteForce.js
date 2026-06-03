import { query } from '../db.js';
import { MAX_LOGIN_ATTEMPTS, LOCK_MINUTES } from './constants.js';

export function isLockedOut(user) {
  if (!user?.bloqueado_ate) return false;
  return new Date(user.bloqueado_ate) > new Date();
}

export function lockoutMessage(user) {
  const until = new Date(user.bloqueado_ate);
  return `Muitas tentativas inválidas. Tente novamente após ${until.toLocaleString('pt-BR')}.`;
}

export async function recordFailedLogin(userId) {
  const { rows } = await query(
    `UPDATE usuarios
     SET tentativas_login = tentativas_login + 1,
         bloqueado_ate = CASE
           WHEN tentativas_login + 1 >= $2
           THEN NOW() + ($3::text || ' minutes')::interval
           ELSE bloqueado_ate
         END,
         updated_at = NOW()
     WHERE id = $1
     RETURNING tentativas_login, bloqueado_ate`,
    [userId, MAX_LOGIN_ATTEMPTS, String(LOCK_MINUTES)]
  );
  return rows[0];
}

export async function resetLoginAttempts(userId) {
  await query(
    `UPDATE usuarios
     SET tentativas_login = 0, bloqueado_ate = NULL, updated_at = NOW()
     WHERE id = $1`,
    [userId]
  );
}
