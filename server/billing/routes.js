import { authMiddleware, activeMiddleware } from '../middleware/auth.js';
import { attachEmpresaContext, requireBillingAccess } from '../auth/permissions.js';
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
  processMercadoPagoWebhook,
  trocarPlano,
} from './billingService.js';
import { verifyWebhookToken } from './gateways/asaas.js';
import { verifyWebhookSignature } from './gateways/mercadoPago.js';
import { getPublicPaymentMethods } from './paymentGatewayFactory.js';
import { getBillingUsage } from './accessControl.js';
import { refreshSubscriptionLifecycle } from './subscriptionLifecycle.js';

async function tipoPerfilFromRequest(req) {
  if (req.user?.tipo_perfil) return req.user.tipo_perfil;
  const { rows } = await query('SELECT tipo_perfil FROM usuarios WHERE id = $1', [req.user.id]);
  return rows[0]?.tipo_perfil || 'juridica';
}

export function registerBillingRoutes(app) {
  const pagamentosReais = async () => isPagamentosReaisEnabled();
  const billingGuard = [authMiddleware, activeMiddleware, attachEmpresaContext, requireBillingAccess];
  const ownerId = (req) => req.empresaContext.empresaOwnerId;

  app.get('/api/billing/public-status', async (_req, res) => {
    try {
      const status = await getPublicPaymentMethods();
      res.json(status);
    } catch (err) {
      console.error('billing/public-status:', err.message);
      res.status(500).json({ error: 'Erro ao consultar pagamento online.' });
    }
  });

  app.get('/api/billing/payment-methods', ...billingGuard, async (_req, res) => {
    try {
      const methods = await getPublicPaymentMethods();
      res.json(methods);
    } catch (err) {
      console.error('billing/payment-methods:', err.message);
      res.status(500).json({ error: 'Erro ao carregar formas de pagamento.' });
    }
  });

  app.get('/api/billing/planos', ...billingGuard, async (req, res) => {
    try {
      const tipoPerfil = await tipoPerfilFromRequest(req);
      const planos = await listPlanosAtivos(tipoPerfil);
      res.json({
        planos,
        pagamentos_reais: await pagamentosReais(),
        segmento: planos[0]?.segmento || null,
      });
    } catch (err) {
      console.error('billing/planos:', err.message);
      res.status(500).json({ error: 'Erro ao listar planos.' });
    }
  });

  app.get('/api/billing/usage', ...billingGuard, async (req, res) => {
    try {
      const usage = await getBillingUsage(ownerId(req));
      res.json(usage);
    } catch (err) {
      console.error('billing/usage:', err.message);
      res.status(500).json({ error: 'Erro ao carregar uso do plano.' });
    }
  });

  app.get('/api/billing/assinatura', ...billingGuard, async (req, res) => {
    try {
      const assinatura = await getAssinaturaUsuario(ownerId(req));
      if (!assinatura) {
        return res.status(404).json({ error: 'Assinatura não encontrada.' });
      }
      res.json({ assinatura, pagamentos_reais: await pagamentosReais() });
    } catch (err) {
      console.error('billing/assinatura:', err.message);
      res.status(500).json({ error: 'Erro ao carregar assinatura.' });
    }
  });

  app.get('/api/billing/faturas', ...billingGuard, async (req, res) => {
    try {
      const faturas = await listFaturasUsuario(ownerId(req));
      res.json({ faturas, pagamentos_reais: await pagamentosReais() });
    } catch (err) {
      console.error('billing/faturas:', err.message);
      res.status(500).json({ error: 'Erro ao listar faturas.' });
    }
  });

  app.get('/api/billing/pagamentos', ...billingGuard, async (req, res) => {
    try {
      const pagamentos = await listPagamentosUsuario(ownerId(req));
      res.json({ pagamentos, pagamentos_reais: await pagamentosReais() });
    } catch (err) {
      console.error('billing/pagamentos:', err.message);
      res.status(500).json({ error: 'Erro ao listar pagamentos.' });
    }
  });

  app.post('/api/billing/trocar-plano', ...billingGuard, async (req, res) => {
    const { plano_slug, planoSlug } = req.body || {};
    const slug = (plano_slug || planoSlug || '').toLowerCase().trim();
    if (!slug) return res.status(400).json({ error: 'Informe plano_slug.' });

    try {
      const result = await trocarPlano(ownerId(req), slug);
      if (!result.ok) return res.status(400).json({ error: result.error });
      res.json({ pagamentos_reais: await pagamentosReais(), ...result });
    } catch (err) {
      console.error('billing/trocar-plano:', err.message);
      res.status(500).json({ error: err.message || 'Erro ao trocar plano.' });
    }
  });

  app.post('/api/billing/checkout', ...billingGuard, async (req, res) => {
    if (!(await pagamentosReais())) {
      return res.status(503).json({
        error: 'Contratação online em ativação. Fale com o suporte para ativar seu plano.',
        code: 'BILLING_NOT_CONFIGURED',
      });
    }

    const {
      plano_slug,
      planoSlug,
      metodo,
      gateway,
      cardToken,
      installments,
      payer,
    } = req.body || {};
    const slug = (plano_slug || planoSlug || '').toLowerCase().trim();
    if (!slug) {
      return res.status(400).json({ error: 'Informe plano_slug (ex.: pf_plus, pj_pro).' });
    }

    try {
      const result = await createCheckout(ownerId(req), slug, {
        metodo: metodo || 'pix',
        gateway,
        cardToken,
        installments,
        payer,
      });
      if (!result.ok) return res.status(400).json({ error: result.error });
      res.json({ ok: true, ...result, pagamentos_reais: true });
    } catch (err) {
      console.error('billing/checkout:', err.message);
      res.status(500).json({ error: err.message || 'Erro ao gerar checkout.' });
    }
  });

  app.post('/api/billing/cancelar', ...billingGuard, async (req, res) => {
    try {
      const result = await cancelarAssinatura(ownerId(req));
      if (!result.ok) return res.status(400).json({ error: result.error });
      res.json({ ok: true, message: result.message, assinatura: result.assinatura });
    } catch (err) {
      console.error('billing/cancelar:', err.message);
      res.status(500).json({ error: 'Erro ao cancelar assinatura.' });
    }
  });

  app.post('/api/billing/assinatura/simular', ...billingGuard, async (req, res) => {
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
      const result = await simularUpgrade(ownerId(req), slug);
      if (!result.ok) return res.status(400).json({ error: result.error });
      res.json({
        ok: true,
        message: result.message,
        assinatura: result.assinatura,
        pagamentos_reais: await pagamentosReais(),
      });
    } catch (err) {
      console.error('billing/simular:', err.message);
      res.status(500).json({ error: 'Erro ao simular upgrade.' });
    }
  });

  app.post('/api/billing/atualizar-status', ...billingGuard, async (req, res) => {
    try {
      const uid = ownerId(req);
      await refreshSubscriptionLifecycle(uid);
      const assinatura = await getAssinaturaUsuario(uid);
      const faturas = await listFaturasUsuario(uid);
      const pagamentos = await listPagamentosUsuario(uid);
      res.json({
        ok: true,
        assinatura,
        faturas,
        pagamentos,
        pagamentos_reais: await pagamentosReais(),
      });
    } catch (err) {
      console.error('billing/atualizar-status:', err.message);
      res.status(500).json({ error: 'Erro ao atualizar status da assinatura.' });
    }
  });

  app.post('/api/billing/webhook/asaas', async (req, res) => {
    if (!(await verifyWebhookToken(req))) {
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

  app.post('/api/billing/webhook/mercado-pago', async (req, res) => {
    if (!(await verifyWebhookSignature(req))) {
      return res.status(401).json({ error: 'Webhook não autorizado.' });
    }

    try {
      const body = req.body || {};
      const result = await processMercadoPagoWebhook(body, req.query || {});
      if (!result.ok && !result.duplicate) {
        console.warn('billing/webhook/mercado-pago:', result.error);
        return res.status(422).json(result);
      }
      res.json(result);
    } catch (err) {
      console.error('billing/webhook/mercado-pago:', err.message);
      res.status(500).json({ error: 'Erro ao processar webhook.' });
    }
  });
}
