import { Router } from 'express';
import { authMiddleware, activeMiddleware } from '../middleware/auth.js';
import { attachEmpresaContext } from '../auth/permissions.js';
import {
  fetchNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
  NOTIFICATION_TYPES,
} from '../notifications/notificationService.js';

const router = Router();
const guard = [authMiddleware, activeMiddleware, attachEmpresaContext];

router.get('/', ...guard, async (req, res) => {
  try {
    const ownerId = req.empresaContext?.empresaOwnerId || req.user.id;
    const tipo = req.query.tipo ? String(req.query.tipo) : undefined;
    const apenasNaoLidas = req.query.nao_lidas === '1';
    const data = await fetchNotificationsForUser(ownerId, { tipo, apenasNaoLidas });
    res.json({ ...data, tipos: NOTIFICATION_TYPES });
  } catch (err) {
    console.error('notifications GET:', err.message);
    res.status(500).json({ error: 'Erro ao carregar notificações.' });
  }
});

router.patch('/:id/lida', ...guard, async (req, res) => {
  try {
    const ownerId = req.empresaContext?.empresaOwnerId || req.user.id;
    const ok = await markNotificationRead(ownerId, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Notificação não encontrada.' });
    res.json({ ok: true });
  } catch (err) {
    console.error('notifications PATCH:', err.message);
    res.status(500).json({ error: 'Erro ao marcar notificação.' });
  }
});

router.post('/marcar-todas-lidas', ...guard, async (req, res) => {
  try {
    const ownerId = req.empresaContext?.empresaOwnerId || req.user.id;
    await markAllNotificationsRead(ownerId);
    res.json({ ok: true });
  } catch (err) {
    console.error('notifications marcar-todas:', err.message);
    res.status(500).json({ error: 'Erro ao marcar notificações.' });
  }
});

export default router;
