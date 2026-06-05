/**
 * Super Admin — Release Candidate e Guia de Produção (Etapa 8.0)
 */
import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import {
  runReleaseCandidateChecks,
  getCriticalAlerts,
  createRcPixTest,
  consultRcPixTest,
  getRcPixTest,
  getRcRecentWebhooks,
} from '../homologacao/releaseCandidate.js';
import {
  getClientChecklist,
  setClientChecklistItem,
} from '../homologacao/clientChecklist.js';
import { getProductionGuide } from '../homologacao/productionGuide.js';

const router = Router();
const guard = [authMiddleware, adminMiddleware];

router.get('/release-candidate', ...guard, async (_req, res) => {
  try {
    res.json(await runReleaseCandidateChecks({}));
  } catch (err) {
    console.error('admin/release-candidate:', err.message);
    res.status(500).json({ error: 'Erro ao carregar Release Candidate.' });
  }
});

router.get('/critical-alerts', ...guard, async (_req, res) => {
  try {
    res.json(await getCriticalAlerts());
  } catch (err) {
    console.error('admin/critical-alerts:', err.message);
    res.status(500).json({ error: 'Erro ao carregar alertas.' });
  }
});

router.get('/release-candidate/pix-test', ...guard, async (_req, res) => {
  try {
    const [test, webhooks] = await Promise.all([getRcPixTest(), getRcRecentWebhooks()]);
    res.json({ ...test, webhooks });
  } catch (err) {
    console.error('admin/pix-test GET:', err.message);
    res.status(500).json({ error: 'Erro ao carregar teste PIX.' });
  }
});

router.post('/release-candidate/pix-test', ...guard, async (_req, res) => {
  try {
    const result = await createRcPixTest();
    if (!result.ok) return res.status(400).json(result);
    const webhooks = await getRcRecentWebhooks();
    res.json({ ...result, webhooks });
  } catch (err) {
    console.error('admin/pix-test POST:', err.message);
    res.status(500).json({ error: 'Erro ao gerar teste PIX.' });
  }
});

router.post('/release-candidate/pix-test/status', ...guard, async (_req, res) => {
  try {
    const result = await consultRcPixTest();
    if (!result.ok) return res.status(400).json(result);
    const webhooks = await getRcRecentWebhooks();
    res.json({ ...result, webhooks });
  } catch (err) {
    console.error('admin/pix-test/status:', err.message);
    res.status(500).json({ error: 'Erro ao consultar PIX.' });
  }
});

router.get('/client-checklist', ...guard, async (_req, res) => {
  try {
    res.json(await getClientChecklist());
  } catch (err) {
    console.error('admin/client-checklist GET:', err.message);
    res.status(500).json({ error: 'Erro ao carregar checklist.' });
  }
});

router.patch('/client-checklist', ...guard, async (req, res) => {
  const { segment, key, checked } = req.body || {};
  try {
    const result = await setClientChecklistItem({
      segment,
      key,
      checked: !!checked,
      adminEmail: req.user?.email,
    });
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) {
    console.error('admin/client-checklist PATCH:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar checklist.' });
  }
});

router.get('/production-guide', ...guard, async (_req, res) => {
  try {
    res.json(await getProductionGuide());
  } catch (err) {
    console.error('admin/production-guide:', err.message);
    res.status(500).json({ error: 'Erro ao carregar guia.' });
  }
});

export default router;
