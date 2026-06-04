/**
 * Super Admin — Configurações de Pagamento (Etapa 7.8)
 */
import { Router } from 'express';
import { authMiddleware, adminMiddleware, adminMasterMiddleware } from '../middleware/auth.js';
import {
  listPaymentConfigMasked,
  patchPaymentConfig,
  activateProvider,
  deactivateProvider,
} from '../billing/paymentConfigService.js';
import { testMercadoPagoConnection } from '../billing/gateways/mercadoPago.js';
import { isAsaasConfiguredAsync } from '../billing/gateways/asaas.js';

const router = Router();

const master = [authMiddleware, adminMiddleware, adminMasterMiddleware];

router.get('/payment-config', ...master, async (_req, res) => {
  try {
    const providers = await listPaymentConfigMasked();
    res.json({
      providers,
      webhooks: {
        mercado_pago: '/api/billing/webhook/mercado-pago',
        asaas: '/api/billing/webhook/asaas',
      },
    });
  } catch (err) {
    console.error('admin/payment-config GET:', err.message);
    res.status(500).json({ error: 'Erro ao carregar configurações.' });
  }
});

router.patch('/payment-config/:provider', ...master, async (req, res) => {
  const provider = req.params.provider;
  const { config, active } = req.body || {};
  try {
    const result = await patchPaymentConfig(provider, { config, active });
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) {
    console.error('admin/payment-config PATCH:', err.message);
    res.status(500).json({ error: 'Erro ao salvar configuração.' });
  }
});

router.post('/payment-config/:provider/test', ...master, async (req, res) => {
  const provider = req.params.provider;
  try {
    if (provider === 'mercado_pago') {
      const result = await testMercadoPagoConnection();
      return res.status(result.ok ? 200 : 400).json(result);
    }
    if (provider === 'asaas') {
      const ok = await isAsaasConfiguredAsync();
      return res.json(
        ok
          ? { ok: true, message: 'Asaas configurado (chave presente).' }
          : { ok: false, error: 'Informe a chave de API do Asaas.' }
      );
    }
    return res.status(400).json({ error: 'Provedor inválido.' });
  } catch (err) {
    console.error('admin/payment-config test:', err.message);
    res.status(500).json({ error: err.message || 'Erro no teste.' });
  }
});

router.post('/payment-config/:provider/activate', ...master, async (req, res) => {
  try {
    const result = await activateProvider(req.params.provider);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) {
    console.error('admin/payment-config activate:', err.message);
    res.status(500).json({ error: 'Erro ao ativar provedor.' });
  }
});

router.post('/payment-config/:provider/deactivate', ...master, async (req, res) => {
  try {
    const result = await deactivateProvider(req.params.provider);
    res.json(result);
  } catch (err) {
    console.error('admin/payment-config deactivate:', err.message);
    res.status(500).json({ error: 'Erro ao desativar provedor.' });
  }
});

export default router;
