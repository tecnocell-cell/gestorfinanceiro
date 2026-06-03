import { Router } from 'express';
import { getSystemConfigStatus } from '../system/configStatus.js';
import { sanitizeForPublic } from '../emailProvider.js';

const router = Router();

router.get('/config-status', async (_req, res) => {
  try {
    const status = await getSystemConfigStatus();
    res.json(sanitizeForPublic(status));
  } catch (err) {
    console.error('system/config-status:', err.message);
    res.status(500).json({ error: 'Erro ao carregar status do sistema.' });
  }
});

export default router;
