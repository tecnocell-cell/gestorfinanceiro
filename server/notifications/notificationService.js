import { query } from '../db.js';
import { syncBillingRemindersForUser } from './billingReminders.js';

export const NOTIFICATION_TYPES = [
  'cobranca',
  'assinatura',
  'seguranca',
  'convite',
  'suporte',
  'sistema',
];

export async function listNotifications(usuarioId, { limit = 50, tipo, apenasNaoLidas = false } = {}) {
  const clauses = ['usuario_id = $1'];
  const params = [usuarioId];
  let n = 2;

  if (tipo && NOTIFICATION_TYPES.includes(tipo)) {
    clauses.push(`tipo = $${n}`);
    params.push(tipo);
    n += 1;
  }
  if (apenasNaoLidas) clauses.push('lida = false');

  params.push(Math.min(200, Math.max(1, limit)));

  const { rows } = await query(
    `SELECT id, tipo, titulo, mensagem, lida, metadata, created_at, lida_em
     FROM usuario_notificacoes
     WHERE ${clauses.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $${n}`,
    params
  );
  return rows;
}

export async function countUnread(usuarioId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS n FROM usuario_notificacoes
     WHERE usuario_id = $1 AND lida = false`,
    [usuarioId]
  );
  return rows[0]?.n || 0;
}

export async function markNotificationRead(usuarioId, notifId) {
  const { rows } = await query(
    `UPDATE usuario_notificacoes
     SET lida = true, lida_em = NOW()
     WHERE id = $1 AND usuario_id = $2
     RETURNING id`,
    [notifId, usuarioId]
  );
  return rows.length > 0;
}

export async function markAllNotificationsRead(usuarioId) {
  await query(
    `UPDATE usuario_notificacoes SET lida = true, lida_em = NOW()
     WHERE usuario_id = $1 AND lida = false`,
    [usuarioId]
  );
}

export async function fetchNotificationsForUser(usuarioId, opts = {}) {
  await syncBillingRemindersForUser(usuarioId);
  const [notificacoes, nao_lidas] = await Promise.all([
    listNotifications(usuarioId, opts),
    countUnread(usuarioId),
  ]);
  return { notificacoes, nao_lidas };
}
