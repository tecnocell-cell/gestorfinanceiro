import { authMiddleware, activeMiddleware } from '../middleware/auth.js';
import { query } from '../db.js';
import {
  listPlanosAtivos,
  getAssinaturaUsuario,
  simularUpgrade,
  isSimulateAllowed,
} from './subscriptions.js';
import {
  isPagamentosReaisEnabled,
  createCheckout,
  cancelarAssinatura,
  listFaturasUsuario,
  listPagamentosUsuario,
  processAsaasWebhook,
} from './billingService.js';
import { verifyWebhookToken } from './gateways/asaas.js';
import { getBillingUsage } from './accessControl.js';

async function tipoPerfilFromRequest(req) {
  if (req.user?.tipo_perfil) return req.user.tipo_perfil;
  const { rows } = await query('SELECT tipo_perfil FROM usuarios WHERE id = $1', [req.user.id]);
  return rows[0]?.tipo_perfil || 'juridica';
}

export function registerBillingRoutes(app) {
  const pagamentosReais = () => isPagamentosReaisEnabled();

  app.get('/api/billing/planos', authMiddleware, activeMiddleware, async (req, res) => {
    try {
      const tipoPerfil = await tipoPerfilFromRequest(req);
      const planos = await listPlanosAtivos(tipoPerfil);
      res.json({
        planos,
        pagamentos_reais: pagamentosReais(),
        segmento: planos[0]?.segmento || null,
      });
    } catch (err) {
      console.error('billing/planos:', err.message);
      res.status(500).json({ error: 'Erro ao listar planos.' });
    }
  });

  app.get('/api/billing/usage', authMiddleware, activeMiddleware, async (req, res) => {
    try {
      const usage = await getBillingUsage(req.user.id);
      res.json(usage);
    } catch (err) {
      console.error('billing/usage:', err.message);
      res.status(500).json({ error: 'Erro ao carregar uso do plano.' });
    }
  });

  app.get('/api/billing/assinatura', authMiddleware, activeMiddleware, async (req, res) => {
    try {
      const assinatura = await getAssinaturaUsuario(req.user.id);
      if (!assinatura) {
        return res.status(404).json({ error: 'Assinatura não encontrada.' });
      }
      res.json({ assinatura, pagamentos_reais: pagamentosReais() });
    } catch (err) {
      console.error('billing/assinatura:', err.message);
      res.status(500).json({ error: 'Erro ao carregar assinatura.' });
    }
  });

  app.get('/api/billing/faturas', authMiddleware, activeMiddleware, async (req, res) => {
    try {
      const faturas = await listFaturasUsuario(req.user.id);
      res.json({ faturas, pagamentos_reais: pagamentosReais() });
    } catch (err) {
      console.error('billing/faturas:', err.message);
      res.status(500).json({ error: 'Erro ao listar faturas.' });
    }
  });

  app.get('/api/billing/pagamentos', authMiddleware, activeMiddleware, async (req, res) => {
    try {
      const pagamentos = await listPagamentosUsuario(req.user.id);
      res.json({ pagamentos, pagamentos_reais: pagamentosReais() });
    } catch (err) {
      console.error('billing/pagamentos:', err.message);
      res.status(500).json({ error: 'Erro ao listar pagamentos.' });
    }
  });

  app.post('/api/billing/checkout', authMiddleware, activeMiddleware, async (req, res) => {
    if (!pagamentosReais()) {
      return res.status(503).json({
        error: 'Cobrança real indisponível. Configure ASAAS_API_KEY ou use simulação em ambiente de teste.',
      });
    }

    const { plano_slug, planoSlug } = req.body || {};
    const slug = (plano_slug || planoSlug || '').toLowerCase().trim();
    if (!slug) {
      return res.status(400).json({ error: 'Informe plano_slug (ex.: pf_plus, pj_pro).' });
    }

    try {
      const result = await createCheckout(req.user.id, slug);
      if (!result.ok) return res.status(400).json({ error: result.error });
      res.json({ ok: true, ...result, pagamentos_reais: true });
    } catch (err) {
      console.error('billing/checkout:', err.message);
      res.status(500).json({ error: err.message || 'Erro ao gerar checkout.' });
    }
  });

  app.post('/api/billing/cancelar', authMiddleware, activeMiddleware, async (req, res) => {
    try {
      const result = await cancelarAssinatura(req.user.id);
      if (!result.ok) return res.status(400).json({ error: result.error });
      res.json({ ok: true, message: result.message, assinatura: result.assinatura });
    } catch (err) {
      console.error('billing/cancelar:', err.message);
      res.status(500).json({ error: 'Erro ao cancelar assinatura.' });
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
        pagamentos_reais: pagamentosReais(),
      });
    } catch (err) {
      console.error('billing/simular:', err.message);
      res.status(500).json({ error: 'Erro ao simular upgrade.' });
    }
  });

  app.post('/api/billing/webhook/asaas', async (req, res) => {
    if (!verifyWebhookToken(req)) {
      return res.status(401).json({ error: 'Webhook não autorizado.' });
    }

    try {
      const body = req.body || {};
      const result = await processAsaasWebhook(body);
      if (!result.ok && !result.duplicate) {
        console.warn('billing/webhook/asaas:', result.error);
        return res.status(422).json(result);
      }
      res.json(result);
    } catch (err) {
      console.error('billing/webhook/asaas:', err.message);
      res.status(500).json({ error: 'Erro ao processar webhook.' });
    }
  });
}
