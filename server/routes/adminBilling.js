/**
 * Admin — operações de cobrança por cliente (Etapa 7.4)
 */
import { Router } from 'express';
import { authMiddleware, adminMiddleware, adminMasterMiddleware } from '../middleware/auth.js';
import {
  adminReenviarCobranca,
  adminMarcarFaturaPaga,
  adminCancelarAssinatura,
  listWebhookEventsForUsuario,
} from '../billing/billingService.js';
import { query } from '../db.js';
const router = Router();

router.post('/clientes/:id/reenviar-cobranca', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await adminReenviarCobranca(req.params.id, req.user.id);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) {
    console.error('admin/reenviar-cobranca:', err.message);
    res.status(500).json({ error: 'Erro ao reenviar cobrança.' });
  }
});

router.post('/clientes/:id/marcar-pago', authMiddleware, adminMasterMiddleware, async (req, res) => {
  const { fatura_id } = req.body || {};
  if (!fatura_id) return res.status(400).json({ error: 'Informe fatura_id.' });
  try {
    const result = await adminMarcarFaturaPaga(req.params.id, fatura_id, req.user.id);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) {
    console.error('admin/marcar-pago:', err.message);
    res.status(500).json({ error: 'Erro ao marcar como pago.' });
  }
});

router.post('/clientes/:id/cancelar-assinatura', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await adminCancelarAssinatura(req.params.id, req.user.id);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) {
    console.error('admin/cancelar-assinatura:', err.message);
    res.status(500).json({ error: 'Erro ao cancelar assinatura.' });
  }
});

router.post('/clientes/:id/prorrogar-trial', authMiddleware, adminMasterMiddleware, async (req, res) => {
  const dias = parseInt(req.body?.dias, 10);
  if (![7, 30].includes(dias)) {
    return res.status(400).json({ error: 'Informe dias: 7 ou 30.' });
  }
  const usuarioId = req.params.id;
  try {
    const { rows } = await query(
      `SELECT id, status, trial_ate FROM assinaturas WHERE usuario_id = $1 LIMIT 1`,
      [usuarioId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Assinatura não encontrada.' });

    const row = rows[0];
    // Base: trial_ate atual (se existir e ainda no futuro) ou hoje
    const base = row.trial_ate && new Date(row.trial_ate) > new Date()
      ? new Date(row.trial_ate)
      : new Date();
    base.setDate(base.getDate() + dias);
    const novoTrialAte = base.toISOString().slice(0, 10);

    await query(
      `UPDATE assinaturas
         SET trial_ate = $1,
             status    = CASE WHEN status IN ('trial','vencida','cancelada') THEN 'trial' ELSE status END,
             updated_at = NOW()
       WHERE usuario_id = $2`,
      [novoTrialAte, usuarioId]
    );

    res.json({ ok: true, message: `Trial prorrogado por ${dias} dias. Novo vencimento: ${novoTrialAte}.`, trial_ate: novoTrialAte });
  } catch (err) {
    console.error('admin/prorrogar-trial:', err.message);
    res.status(500).json({ error: 'Erro ao prorrogar trial.' });
  }
});

router.get('/clientes/:id/webhooks', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const eventos = await listWebhookEventsForUsuario(req.params.id);
    res.json({ eventos });
  } catch (err) {
    console.error('admin/webhooks:', err.message);
    res.status(500).json({ error: 'Erro ao listar webhooks.' });
  }
});

export default router;
