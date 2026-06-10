/**
 * subscriptionGuard — bloqueia acesso a rotas core quando assinatura está vencida.
 *
 * Deve ser aplicado APÓS authMiddleware e activeMiddleware.
 * Admins (role = 'admin') são sempre liberados.
 *
 * Rotas isentas (não precisam usar este guard):
 *   /api/auth/*
 *   /api/billing/*
 *   /api/health
 *   /api/status
 */

import { query } from '../db.js';
import { refreshSubscriptionLifecycle } from '../billing/subscriptionLifecycle.js';
import { ensureAssinaturaPadrao } from '../billing/subscriptions.js';

export async function subscriptionGuard(req, res, next) {
  // Rotas sem autenticação (webhooks públicos, etc.) passam sempre
  if (!req.user) return next();

  // Admins nunca são bloqueados por assinatura
  if (req.user.role === 'admin') return next();

  const usuarioId = req.user.id;

  try {
    await ensureAssinaturaPadrao(usuarioId);
    await refreshSubscriptionLifecycle(usuarioId);

    const { rows } = await query(
      `SELECT status FROM assinaturas WHERE usuario_id = $1 LIMIT 1`,
      [usuarioId]
    );

    const status = rows[0]?.status;

    if (status === 'vencida') {
      return res.status(402).json({
        error: 'Assinatura necessária para continuar.',
        code: 'SUBSCRIPTION_REQUIRED',
      });
    }

    next();
  } catch (err) {
    console.error('[subscriptionGuard]', err.message);
    // Em caso de erro interno, não bloqueamos o usuário — deixamos passar
    next();
  }
}
