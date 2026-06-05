/**
 * Admin SaaS — clientes, planos, alertas, métricas (Etapa 7.3)
 * Não expõe lançamentos nem estado financeiro dos tenants.
 */
import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { query } from '../db.js';
import { adminChangeClientePlano } from '../billing/adminPlanoChange.js';
import { ensureAssinaturaPadrao } from '../billing/subscriptions.js';
import {
  gatewayProviderLabel,
  metodoPagamentoLabel,
} from '../billing/paymentConfigService.js';

const router = Router();

function diasParaVencimento(row) {
  const ref =
    row.assinatura_status === 'trial'
      ? row.trial_ate
      : row.proxima_cobranca;
  if (!ref) return null;
  const end = new Date(ref);
  end.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((end - now) / 86400000);
}

function formatCentavos(centavos) {
  if (centavos == null) return null;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number(centavos) / 100
  );
}

function formatClienteRow(row) {
  const dias = diasParaVencimento(row);
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    telefone: row.telefone || '',
    tipo_perfil: row.tipo_perfil,
    nome_perfil: row.nome_perfil,
    ativo: row.ativo,
    ultimo_acesso: row.ultimo_acesso,
    ultima_atividade: row.ultima_atividade || row.ultimo_acesso,
    created_at: row.created_at,
    plano_slug: row.plano_slug,
    plano_nome: row.plano_nome,
    plano_valor_centavos: row.plano_valor_centavos ?? row.preco_centavos ?? null,
    plano_valor_formatado: formatCentavos(row.plano_valor_centavos ?? row.preco_centavos),
    assinatura_status: row.assinatura_status,
    trial_ate: row.trial_ate,
    proxima_cobranca: row.proxima_cobranca,
    dias_para_vencimento: dias,
    total_pago_centavos: Number(row.total_pago_centavos || 0),
    total_pago_formatado: formatCentavos(row.total_pago_centavos || 0),
    faturas_vencidas: Number(row.faturas_vencidas || 0),
    gateway_pagamento: gatewayProviderLabel(row.gateway_provider),
    metodo_pagamento: row.ultimo_payload
      ? metodoPagamentoLabel(row.ultimo_payload)
      : 'Manual',
  };
}

const FILTRO_SQL = {
  pf: `u.tipo_perfil = 'fisica'`,
  pj: `u.tipo_perfil = 'juridica'`,
  trial: `a.status = 'trial'`,
  ativos: `u.ativo = true AND a.status IN ('ativa', 'trial')`,
  atrasados: `a.status = 'atrasada'`,
  vencidos: `a.status = 'vencida'`,
  cancelados: `a.status = 'cancelada'`,
};

router.get('/clientes', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const filtro = String(req.query.filtro || 'todos').toLowerCase();
    const q = String(req.query.q || '').trim();
    const clauses = [`u.role = 'user'`];
    const params = [];
    let n = 1;

    if (FILTRO_SQL[filtro]) clauses.push(FILTRO_SQL[filtro]);

    if (q) {
      const like = `%${q}%`;
      clauses.push(
        `(u.nome ILIKE $${n} OR u.email ILIKE $${n} OR u.nome_perfil ILIKE $${n} OR COALESCE(u.telefone, '') ILIKE $${n})`
      );
      params.push(like);
      n += 1;
    }

    const { rows } = await query(
      `SELECT u.id, u.email, u.nome, u.telefone, u.tipo_perfil, u.nome_perfil, u.ativo,
              u.ultimo_acesso, u.created_at,
              e.updated_at AS ultima_atividade,
              p.slug AS plano_slug, p.nome AS plano_nome, p.preco_centavos AS plano_valor_centavos,
              a.status AS assinatura_status, a.trial_ate, a.proxima_cobranca,
              a.gateway AS gateway_provider,
              (SELECT pg.payload FROM pagamentos pg WHERE pg.usuario_id = u.id ORDER BY pg.created_at DESC LIMIT 1) AS ultimo_payload,
              COALESCE((
                SELECT SUM(pg.valor_centavos)::bigint
                FROM pagamentos pg
                WHERE pg.usuario_id = u.id AND pg.status = 'confirmado'
              ), 0) AS total_pago_centavos,
              COALESCE((
                SELECT COUNT(*)::int
                FROM faturas f
                WHERE f.usuario_id = u.id
                  AND f.status IN ('pendente', 'vencida')
                  AND f.vencimento < CURRENT_DATE
              ), 0) AS faturas_vencidas
       FROM usuarios u
       LEFT JOIN assinaturas a ON a.usuario_id = u.id
       LEFT JOIN planos p ON p.id = a.plano_id
       LEFT JOIN estados e ON e.usuario_id = u.id
       WHERE ${clauses.join(' AND ')}
       ORDER BY u.created_at DESC
       LIMIT 500`,
      params
    );

    res.json({ clientes: rows.map(formatClienteRow) });
  } catch (err) {
    console.error('admin/clientes GET:', err.message);
    res.status(500).json({ error: 'Erro ao listar clientes.' });
  }
});

router.get('/clientes/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows: uRows } = await query(
      `SELECT u.id, u.email, u.nome, u.telefone, u.tipo_perfil, u.nome_perfil, u.ativo,
              u.ultimo_acesso, u.created_at, e.updated_at AS ultima_atividade
       FROM usuarios u
       LEFT JOIN estados e ON e.usuario_id = u.id
       WHERE u.id = $1 AND u.role = 'user'`,
      [id]
    );
    if (!uRows.length) return res.status(404).json({ error: 'Cliente não encontrado.' });

    await ensureAssinaturaPadrao(id);

    const { rows: subRows } = await query(
      `SELECT a.id, a.status, a.inicio_em, a.fim_em, a.trial_ate, a.proxima_cobranca,
              a.cancelada_em, a.acesso_ate,
              p.slug, p.nome, p.preco_centavos
       FROM assinaturas a
       JOIN planos p ON p.id = a.plano_id
       WHERE a.usuario_id = $1`,
      [id]
    );

    const { rows: faturas } = await query(
      `SELECT id, valor_centavos, status, vencimento, pago_em, created_at
       FROM faturas WHERE usuario_id = $1 ORDER BY created_at DESC LIMIT 24`,
      [id]
    );

    const { rows: pagamentos } = await query(
      `SELECT p.id, p.valor_centavos, p.status, p.created_at, p.gateway,
              p.gateway_payment_id, p.fatura_id, p.payload, f.pago_em
       FROM pagamentos p
       LEFT JOIN faturas f ON f.id = p.fatura_id
       WHERE p.usuario_id = $1
       ORDER BY p.created_at DESC
       LIMIT 24`,
      [id]
    );

    let equipe = [];
    try {
      const { rows: eq } = await query(
        `SELECT eu.perfil, eu.status, u.nome, u.email
         FROM empresa_usuarios eu
         JOIN usuarios u ON u.id = eu.membro_usuario_id
         WHERE eu.empresa_usuario_id = $1 AND eu.status != 'removido'
         ORDER BY eu.created_at`,
        [id]
      );
      equipe = eq;
    } catch {
      equipe = [];
    }

    const { rows: waRows } = await query(
      `SELECT id, phone_number, label, is_primary, active
       FROM whatsapp_authorized_numbers WHERE usuario_id = $1 ORDER BY is_primary DESC`,
      [id]
    );

    const sub = subRows[0] || {};
    const cliente = formatClienteRow({
      ...uRows[0],
      plano_slug: sub.slug,
      plano_nome: sub.nome,
      assinatura_status: sub.status,
      trial_ate: sub.trial_ate,
      proxima_cobranca: sub.proxima_cobranca,
    });

    res.json({
      cliente,
      assinatura: subRows[0]
        ? {
            id: sub.id,
            status: sub.status,
            inicio_em: sub.inicio_em,
            fim_em: sub.fim_em,
            trial_ate: sub.trial_ate,
            proxima_cobranca: sub.proxima_cobranca,
            cancelada_em: sub.cancelada_em,
            acesso_ate: sub.acesso_ate,
            plano: {
              slug: sub.slug,
              nome: sub.nome,
              preco_centavos: sub.preco_centavos,
            },
          }
        : null,
      faturas,
      pagamentos,
      equipe,
      whatsapps: waRows,
    });
  } catch (err) {
    console.error('admin/clientes/:id GET:', err.message);
    res.status(500).json({ error: 'Erro ao carregar cliente.' });
  }
});

router.post('/clientes/:id/plano', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { plano_slug } = req.body || {};
  try {
    const result = await adminChangeClientePlano({
      alvoUsuarioId: id,
      planoSlug: plano_slug,
      adminUsuarioId: req.user.id,
    });
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) {
    console.error('admin/clientes/:id/plano POST:', err.message);
    res.status(500).json({ error: 'Erro ao alterar plano.' });
  }
});

router.get('/cobranca-alertas', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT
         COUNT(*) FILTER (
           WHERE a.status = 'trial' AND a.trial_ate IS NOT NULL
             AND a.trial_ate::date <= CURRENT_DATE + 7
         )::int AS trials_7d,
         COUNT(*) FILTER (
           WHERE a.status = 'trial' AND a.trial_ate IS NOT NULL
             AND a.trial_ate::date <= CURRENT_DATE + 3
         )::int AS trials_3d,
         COUNT(*) FILTER (WHERE a.status = 'vencida')::int AS vencidas,
         COUNT(*) FILTER (WHERE a.status = 'atrasada')::int AS atrasadas,
         COUNT(*) FILTER (WHERE a.status = 'cancelada')::int AS canceladas,
         COUNT(*) FILTER (
           WHERE a.proxima_cobranca IS NOT NULL
             AND a.proxima_cobranca::date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
             AND a.status IN ('ativa', 'atrasada')
         )::int AS cobrancas_semana
       FROM assinaturas a
       JOIN usuarios u ON u.id = a.usuario_id
       WHERE u.role = 'user'`
    );
    const r = rows[0] || {};
    res.json({
      trials_terminando_7d: r.trials_7d || 0,
      trials_terminando_3d: r.trials_3d || 0,
      assinaturas_vencidas: r.vencidas || 0,
      assinaturas_atrasadas: r.atrasadas || 0,
      assinaturas_canceladas: r.canceladas || 0,
      cobrancas_vencem_semana: r.cobrancas_semana || 0,
      avisos: buildCobrancaAvisos(r),
    });
  } catch (err) {
    console.error('admin/cobranca-alertas:', err.message);
    res.status(500).json({ error: 'Erro ao carregar alertas de cobrança.' });
  }
});

function buildCobrancaAvisos(r) {
  const avisos = [];
  if (r.trials_3d > 0) {
    avisos.push({
      severity: 'warn',
      message: `${r.trials_3d} trial${r.trials_3d > 1 ? 's' : ''} terminam em até 3 dias`,
    });
  } else if (r.trials_7d > 0) {
    avisos.push({
      severity: 'info',
      message: `${r.trials_7d} trial${r.trials_7d > 1 ? 's' : ''} terminam em até 7 dias`,
    });
  }
  if (r.vencidas > 0) {
    avisos.push({
      severity: 'error',
      message: `${r.vencidas} assinatura${r.vencidas > 1 ? 's' : ''} vencida${r.vencidas > 1 ? 's' : ''}`,
    });
  }
  if (r.atrasadas > 0) {
    avisos.push({
      severity: 'warn',
      message: `${r.atrasadas} assinatura${r.atrasadas > 1 ? 's' : ''} atrasada${r.atrasadas > 1 ? 's' : ''}`,
    });
  }
  if (r.cobrancas_semana > 0) {
    avisos.push({
      severity: 'info',
      message: `${r.cobrancas_semana} cobrança${r.cobrancas_semana > 1 ? 's' : ''} vencem esta semana`,
    });
  }
  if (r.canceladas > 0) {
    avisos.push({
      severity: 'muted',
      message: `${r.canceladas} assinatura${r.canceladas > 1 ? 's' : ''} cancelada${r.canceladas > 1 ? 's' : ''}`,
    });
  }
  return avisos;
}

router.get('/saas-metrics', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const { rows: m } = await query(
      `SELECT
         COALESCE(SUM(p.preco_centavos) FILTER (WHERE a.status = 'ativa'), 0)::bigint AS mrr_centavos,
         COUNT(*) FILTER (WHERE a.status = 'trial')::int AS trials_ativos,
         COUNT(*) FILTER (WHERE a.status = 'ativa')::int AS assinaturas_ativas,
         COUNT(*) FILTER (
           WHERE a.status = 'cancelada' AND a.cancelada_em >= NOW() - INTERVAL '30 days'
         )::int AS churn_30d,
         COUNT(*) FILTER (
           WHERE a.status = 'ativa' AND a.trial_ate IS NOT NULL
         )::int AS conversoes_trial_pago
       FROM assinaturas a
       JOIN planos p ON p.id = a.plano_id
       JOIN usuarios u ON u.id = a.usuario_id
       WHERE u.role = 'user'`
    );
    const row = m[0] || {};
    const mrr = Number(row.mrr_centavos || 0);
    const trials = row.trials_ativos || 0;
    const ativas = row.assinaturas_ativas || 0;
    const conversoes = row.conversoes_trial_pago || 0;
    const baseConv = trials + conversoes + ativas;
    const conversaoPct = baseConv > 0 ? Math.round((conversoes / baseConv) * 1000) / 10 : 0;
    const churnBase = ativas + (row.churn_30d || 0);
    const churnPct =
      churnBase > 0 ? Math.round(((row.churn_30d || 0) / churnBase) * 1000) / 10 : 0;

    const fmt = (c) =>
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c / 100);

    res.json({
      mrr_centavos: mrr,
      mrr_formatado: fmt(mrr),
      arr_centavos: mrr * 12,
      arr_formatado: fmt(mrr * 12),
      trials_ativos: trials,
      conversao_trial_pago_pct: conversaoPct,
      churn_30d: row.churn_30d || 0,
      churn_30d_pct: churnPct,
    });
  } catch (err) {
    console.error('admin/saas-metrics:', err.message);
    res.status(500).json({ error: 'Erro ao carregar métricas SaaS.' });
  }
});

export default router;
