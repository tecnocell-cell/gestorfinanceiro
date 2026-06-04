/**
 * Visão operacional SaaS — somente super admin (role admin). Etapa 7.1 / 7.2
 * Não expõe lançamentos nem estado financeiro dos clientes.
 */
import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { query } from '../db.js';
import {
  getAsaasEnv,
  isAsaasRealKeyConfigured,
  isWebhookConfigured,
} from '../billing/gateways/asaas.js';
import { expectedWebhookUrl } from '../billing/billingHealthLib.js';
import { getGoLiveStatus } from '../homologacao/goLiveStatus.js';
import { runProductionChecks } from '../homologacao/productionCheck.js';
import { getBetaHomologacao, setBetaHomologacaoItem } from '../homologacao/betaChecklist.js';

const router = Router();

router.get('/overview', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const { rows: users } = await query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE tipo_perfil = 'fisica')::int AS pf,
         COUNT(*) FILTER (WHERE tipo_perfil = 'juridica')::int AS pj,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS novos_7d,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS novos_30d,
         COUNT(*) FILTER (WHERE ativo = true AND ultimo_acesso >= NOW() - INTERVAL '30 days')::int AS ativos_30d
       FROM usuarios WHERE role = 'user'`
    );

    const { rows: subs } = await query(
      `SELECT
         COUNT(*) FILTER (WHERE a.status = 'trial')::int AS trials,
         COUNT(*) FILTER (WHERE a.status = 'ativa')::int AS ativas,
         COUNT(*) FILTER (WHERE a.status = 'atrasada')::int AS atrasadas,
         COUNT(*) FILTER (WHERE a.status = 'vencida')::int AS vencidas,
         COALESCE(SUM(p.preco_centavos) FILTER (WHERE a.status = 'ativa'), 0)::bigint AS mrr_centavos
       FROM assinaturas a
       JOIN planos p ON p.id = a.plano_id
       JOIN usuarios u ON u.id = a.usuario_id
       WHERE u.role = 'user'`
    );

    const { rows: planPf } = await query(
      `SELECT COUNT(*)::int AS n FROM assinaturas a
       JOIN planos p ON p.id = a.plano_id
       JOIN usuarios u ON u.id = a.usuario_id
       WHERE u.role = 'user' AND u.tipo_perfil = 'fisica' AND a.status IN ('ativa','trial')
         AND p.slug LIKE 'pf_%'`
    );
    const { rows: planPj } = await query(
      `SELECT COUNT(*)::int AS n FROM assinaturas a
       JOIN planos p ON p.id = a.plano_id
       JOIN usuarios u ON u.id = a.usuario_id
       WHERE u.role = 'user' AND u.tipo_perfil = 'juridica' AND a.status IN ('ativa','trial')
         AND p.slug LIKE 'pj_%'`
    );

    let ticketsAbertos = 0;
    try {
      const { rows: tk } = await query(
        `SELECT COUNT(*)::int AS n FROM support_tickets WHERE status IN ('aberto', 'em_andamento')`
      );
      ticketsAbertos = tk[0]?.n || 0;
    } catch {
      ticketsAbertos = 0;
    }

    const u = users[0] || {};
    const s = subs[0] || {};

    res.json({
      usuarios: {
        total: u.total || 0,
        pf: u.pf || 0,
        pj: u.pj || 0,
        novos_7d: u.novos_7d || 0,
        novos_30d: u.novos_30d || 0,
        ativos_30d: u.ativos_30d || 0,
      },
      assinaturas: {
        trials: s.trials || 0,
        ativas: s.ativas || 0,
        atrasadas: s.atrasadas || 0,
        vencidas: s.vencidas || 0,
      },
      planos: {
        pf_ativos: planPf[0]?.n || 0,
        pj_ativos: planPj[0]?.n || 0,
      },
      suporte: { tickets_abertos: ticketsAbertos },
      mrr_estimado_centavos: Number(s.mrr_centavos || 0),
      receita_estimada_formatada: new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(Number(s.mrr_centavos || 0) / 100),
      mrr_estimado_formatado: new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(Number(s.mrr_centavos || 0) / 100),
    });
  } catch (err) {
    console.error('admin/overview:', err.message);
    res.status(500).json({ error: 'Erro ao carregar visão operacional.' });
  }
});

router.get('/billing-health', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const configured = isAsaasRealKeyConfigured();
    const environment = configured
      ? getAsaasEnv()
      : process.env.BILLING_USE_MOCK_GATEWAY === 'true'
        ? 'mock'
        : 'not_configured';

    const { rows: subRows } = await query(
      `SELECT COUNT(*)::int AS n FROM assinaturas WHERE status = 'ativa'`
    );
    const { rows: fatRows } = await query(
      `SELECT COUNT(*)::int AS n FROM faturas WHERE status = 'pendente'`
    );

    res.json({
      configured,
      environment,
      webhookConfigured: isWebhookConfigured(),
      webhookUrl: expectedWebhookUrl(),
      activeSubscriptions: subRows[0]?.n || 0,
      pendingInvoices: fatRows[0]?.n || 0,
    });
  } catch (err) {
    console.error('admin/billing-health:', err.message);
    res.status(500).json({ error: 'Erro ao diagnosticar cobrança.' });
  }
});

router.get('/go-live', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const status = await getGoLiveStatus();
    res.json(status);
  } catch (err) {
    console.error('admin/go-live:', err.message);
    res.status(500).json({ error: 'Erro ao carregar status go-live.' });
  }
});

router.get('/production-check', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const result = await runProductionChecks({});
    res.json(result);
  } catch (err) {
    console.error('admin/production-check:', err.message);
    res.status(500).json({ error: 'Erro no checklist de produção.' });
  }
});

router.get('/beta-homologacao', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    res.json(await getBetaHomologacao());
  } catch (err) {
    console.error('admin/beta-homologacao GET:', err.message);
    res.status(500).json({ error: 'Erro ao carregar checklist beta.' });
  }
});

router.patch('/beta-homologacao', authMiddleware, adminMiddleware, async (req, res) => {
  const { segment, key, checked } = req.body || {};
  try {
    const result = await setBetaHomologacaoItem({
      segment,
      key,
      checked: !!checked,
      adminEmail: req.user?.email,
    });
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) {
    console.error('admin/beta-homologacao PATCH:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar checklist beta.' });
  }
});

export default router;
