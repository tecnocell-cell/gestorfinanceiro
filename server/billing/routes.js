import { authMiddleware, activeMiddleware } from '../middleware/auth.js';
import { query } from '../db.js';
import {
  listPlanosAtivos,
  getAssinaturaUsuario,
  simularUpgrade,
  isSimulateAllowed,
} from './subscriptions.js';

async function tipoPerfilFromRequest(req) {
  if (req.user?.tipo_perfil) return req.user.tipo_perfil;
  const { rows } = await query('SELECT tipo_perfil FROM usuarios WHERE id = $1', [req.user.id]);
  return rows[0]?.tipo_perfil || 'juridica';
}

export function registerBillingRoutes(app) {
  app.get('/api/billing/planos', authMiddleware, activeMiddleware, async (req, res) => {
    try {
      const tipoPerfil = await tipoPerfilFromRequest(req);
      const planos = await listPlanosAtivos(tipoPerfil);
      res.json({ planos, pagamentos_reais: false, segmento: planos[0]?.segmento || null });
    } catch (err) {
      console.error('billing/planos:', err.message);
      res.status(500).json({ error: 'Erro ao listar planos.' });
    }
  });

  app.get('/api/billing/assinatura', authMiddleware, activeMiddleware, async (req, res) => {
    try {
      const assinatura = await getAssinaturaUsuario(req.user.id);
      if (!assinatura) {
        return res.status(404).json({ error: 'Assinatura não encontrada.' });
      }
      res.json({ assinatura, pagamentos_reais: false });
    } catch (err) {
      console.error('billing/assinatura:', err.message);
      res.status(500).json({ error: 'Erro ao carregar assinatura.' });
    }
  });

  app.post('/api/billing/assinatura/simular', authMiddleware, activeMiddleware, async (req, res) => {
    if (!isSimulateAllowed()) {
      return res.status(403).json({
        error: 'Simulação de plano desabilitada neste ambiente.',
      });
    }

    const { plano_slug, planoSlug } = req.body || {};
    const slug = (plano_slug || planoSlug || '').toLowerCase().trim();
    if (!slug) {
      return res.status(400).json({ error: 'Informe plano_slug (ex.: pf_plus, pj_pro).' });
    }

    try {
      const result = await simularUpgrade(req.user.id, slug);
      if (!result.ok) return res.status(400).json({ error: result.error });
      res.json({
        ok: true,
        message: result.message,
        assinatura: result.assinatura,
        pagamentos_reais: false,
      });
    } catch (err) {
      console.error('billing/simular:', err.message);
      res.status(500).json({ error: 'Erro ao simular upgrade.' });
    }
  });
}
