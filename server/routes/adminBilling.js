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
