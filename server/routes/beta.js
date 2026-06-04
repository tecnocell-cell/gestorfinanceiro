import { Router } from 'express';
import { query } from '../db.js';
import { authMiddleware, activeMiddleware, adminMiddleware } from '../middleware/auth.js';
import { getBetaPublicConfig, isBetaMode } from '../beta/betaConfig.js';
import {
  createFeedback,
  listFeedback,
  patchFeedbackStatus,
  getBetaAdminSummary,
} from '../beta/feedbackService.js';
import {
  getUserBetaChecklist,
  markChecklistItem,
  getBetaChecklistAggregate,
} from '../beta/userChecklist.js';

const router = Router();
const userGuard = [authMiddleware, activeMiddleware];

router.get('/config', (_req, res) => {
  res.json(getBetaPublicConfig());
});

router.get('/checklist', ...userGuard, async (req, res) => {
  try {
    if (!isBetaMode()) {
      return res.json({ betaMode: false, checklist: null });
    }
    let tipoPerfil = req.user.tipo_perfil;
    if (!tipoPerfil) {
      const { rows } = await query('SELECT tipo_perfil FROM usuarios WHERE id = $1', [req.user.id]);
      tipoPerfil = rows[0]?.tipo_perfil;
    }
    const checklist = await getUserBetaChecklist(req.user.id, tipoPerfil);
    res.json({ betaMode: true, checklist });
  } catch (err) {
    console.error('beta/checklist GET:', err.message);
    res.status(500).json({ error: 'Erro ao carregar checklist beta.' });
  }
});

router.post('/checklist/mark', ...userGuard, async (req, res) => {
  try {
    if (!isBetaMode()) return res.status(403).json({ error: 'Modo beta inativo.' });
    const { item_key } = req.body || {};
    const result = await markChecklistItem(req.user.id, item_key);
    res.json(result);
  } catch (err) {
    console.error('beta/checklist/mark:', err.message);
    res.status(400).json({ error: err.message });
  }
});

router.post('/feedback', ...userGuard, async (req, res) => {
  try {
    if (!isBetaMode()) return res.status(403).json({ error: 'Modo beta inativo.' });
    const { tela, tipo, mensagem } = req.body || {};
    const row = await createFeedback({
      usuarioId: req.user.id,
      tela: tela || req.headers['x-beta-tela'] || 'app',
      tipo,
      mensagem,
    });
    res.status(201).json({ feedback: row });
  } catch (err) {
    console.error('beta/feedback POST:', err.message);
    res.status(400).json({ error: err.message });
  }
});

router.get('/feedback', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const rows = await listFeedback({
      status: req.query.status,
      tipo: req.query.tipo,
    });
    res.json({ feedbacks: rows });
  } catch (err) {
    console.error('beta/feedback GET:', err.message);
    res.status(500).json({ error: 'Erro ao listar feedbacks.' });
  }
});

router.patch('/feedback/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { status } = req.body || {};
    const row = await patchFeedbackStatus(Number(req.params.id), status);
    if (!row) return res.status(404).json({ error: 'Feedback não encontrado.' });
    res.json({ feedback: row });
  } catch (err) {
    console.error('beta/feedback PATCH:', err.message);
    res.status(400).json({ error: err.message });
  }
});

router.get('/admin/summary', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const [summary, checklistAgg, feedbacks] = await Promise.all([
      getBetaAdminSummary(),
      getBetaChecklistAggregate(),
      listFeedback({ limit: 50 }),
    ]);
    res.json({
      betaMode: isBetaMode(),
      ...summary,
      checklist_medio_percent: checklistAgg.media_percent,
      checklist_usuarios_amostra: checklistAgg.usuarios,
      feedbacks_recentes: feedbacks,
    });
  } catch (err) {
    console.error('beta/admin/summary:', err.message);
    res.status(500).json({ error: 'Erro ao carregar painel beta.' });
  }
});

export default router;
