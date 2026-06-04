import { query } from '../db.js';
import {
  getPlanoBySlug,
  getAssinaturaUsuario,
  ensureAssinaturaPadrao,
} from './subscriptions.js';
import { planoMatchesTipoPerfil } from './planResources.js';
import {
  isAsaasConfigured,
  createOrGetCustomer,
  createPixPayment,
  paymentExternalRef,
  parsePaymentExternalRef,
  PAYMENT_CONFIRM_EVENTS,
  buildWebhookIdempotencyKey,
} from './gateways/asaas.js';
import { refreshSubscriptionLifecycle } from './subscriptionLifecycle.js';
import { BILLING_RULES_DOC, isUpgrade, isDowngrade } from './billingRules.js';
import {
  emailCobrancaCriada,
  emailPagamentoConfirmado,
  emailAssinaturaAtrasada,
  emailAssinaturaCancelada,
} from './billingEmails.js';
import { insertAdminSaasAudit } from './adminPlanoChange.js';

export function isPagamentosReaisEnabled() {
  return isAsaasConfigured();
}

function formatDateYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function periodEndFromInterval(intervalo, from = new Date()) {
  const end = new Date(from);
  if (intervalo === 'anual') {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return end;
}

async function getUsuario(usuarioId) {
  const { rows } = await query(
    `SELECT id, email, nome, tipo_perfil FROM usuarios WHERE id = $1`,
    [usuarioId]
  );
  return rows[0] || null;
}

async function fetchAssinaturaId(usuarioId) {
  await ensureAssinaturaPadrao(usuarioId);
  const { rows } = await query(`SELECT id FROM assinaturas WHERE usuario_id = $1`, [usuarioId]);
  return rows[0]?.id || null;
}

export async function createCheckout(usuarioId, planoSlug) {
  if (!isPagamentosReaisEnabled()) {
    return { ok: false, error: 'Cobrança real não configurada (ASAAS_API_KEY).' };
  }

  const plano = await getPlanoBySlug(planoSlug);
  if (!plano) return { ok: false, error: 'Plano não encontrado.' };

  const usuario = await getUsuario(usuarioId);
  if (!planoMatchesTipoPerfil(plano.slug, usuario.tipo_perfil)) {
    return { ok: false, error: 'Plano não disponível para seu perfil (PF/PJ).' };
  }

  if (!plano.preco_centavos || plano.preco_centavos <= 0) {
    return { ok: false, error: 'Plano sem cobrança configurada.' };
  }

  const assinaturaId = await fetchAssinaturaId(usuarioId);
  const { rows: subRows } = await query(
    `SELECT gateway_customer_id FROM assinaturas WHERE id = $1`,
    [assinaturaId]
  );

  let customerId = subRows[0]?.gateway_customer_id;
  if (!customerId) {
    const customer = await createOrGetCustomer({
      name: usuario.nome || usuario.email,
      email: usuario.email,
      externalReference: `fluxiva:user:${usuarioId}`,
    });
    customerId = customer.id;
    await query(
      `UPDATE assinaturas SET gateway = 'asaas', gateway_customer_id = $1, updated_at = NOW() WHERE id = $2`,
      [customerId, assinaturaId]
    );
  }

  const dueDate = formatDateYmd(addDays(new Date(), 3));
  const { rows: faturaRows } = await query(
    `INSERT INTO faturas (usuario_id, assinatura_id, gateway, valor_centavos, status, vencimento)
     VALUES ($1, $2, 'asaas', $3, 'pendente', $4)
     RETURNING id, vencimento`,
    [usuarioId, assinaturaId, plano.preco_centavos, dueDate]
  );
  const fatura = faturaRows[0];
  const extRef = paymentExternalRef(fatura.id);

  const payment = await createPixPayment({
    customerId,
    valueReais: plano.preco_centavos / 100,
    dueDate,
    description: `Fluxiva — ${plano.nome}`,
    externalReference: extRef,
  });

  await query(
    `UPDATE faturas SET gateway_invoice_id = $1 WHERE id = $2`,
    [payment.id, fatura.id]
  );

  const { rows: pagRows } = await query(
    `INSERT INTO pagamentos (usuario_id, assinatura_id, fatura_id, gateway, gateway_payment_id, valor_centavos, status, payload)
     VALUES ($1, $2, $3, 'asaas', $4, $5, 'pendente', $6)
     RETURNING id`,
    [
      usuarioId,
      assinaturaId,
      fatura.id,
      payment.id,
      plano.preco_centavos,
      JSON.stringify({
        billingType: 'PIX',
        mock: payment.mock || false,
        target_plano_id: plano.id,
        target_plano_slug: plano.slug,
        pix: {
          copy_paste: payment.payload || null,
          encoded_image: payment.encodedImage || null,
          invoice_url: payment.invoiceUrl || null,
        },
      }),
    ]
  );

  const invoiceUrl =
    payment.invoiceUrl ||
    (payment.id ? `https://www.asaas.com/i/${payment.id}` : null);

  emailCobrancaCriada(usuarioId, {
    planoNome: plano.nome,
    valorCentavos: plano.preco_centavos,
    vencimento: fatura.vencimento,
    invoiceUrl,
  }).catch(() => {});

  return {
    ok: true,
    fatura_id: fatura.id,
    pagamento_id: pagRows[0].id,
    gateway_payment_id: payment.id,
    valor_centavos: plano.preco_centavos,
    vencimento: fatura.vencimento,
    pix: {
      encoded_image: payment.encodedImage || null,
      copy_paste: payment.payload || null,
      invoice_url: invoiceUrl,
    },
    plano_slug: plano.slug,
    regra: BILLING_RULES_DOC.upgrade,
  };
}

export async function activateSubscriptionFromPayment(faturaId, paidAt = new Date()) {
  const { rows } = await query(
    `SELECT f.id, f.usuario_id, f.assinatura_id, f.valor_centavos, f.status,
            a.plano_id, p.intervalo AS plano_intervalo, p.slug AS plano_slug, p.nome AS plano_nome
     FROM faturas f
     JOIN assinaturas a ON a.id = f.assinatura_id
     JOIN planos p ON p.id = a.plano_id
     WHERE f.id = $1`,
    [faturaId]
  );
  const fatura = rows[0];
  if (!fatura) return { ok: false, error: 'Fatura não encontrada.' };
  if (fatura.status === 'paga') return { ok: true, already: true };

  const { rows: payRows } = await query(
    `SELECT payload FROM pagamentos WHERE fatura_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [faturaId]
  );
  const payload =
    typeof payRows[0]?.payload === 'string'
      ? JSON.parse(payRows[0].payload)
      : payRows[0]?.payload || {};
  const targetPlanoId = payload.target_plano_id || null;
  let intervalo = fatura.plano_intervalo;
  let planoNome = fatura.plano_nome;

  if (targetPlanoId) {
    const { rows: tp } = await query(
      `SELECT id, intervalo, nome, slug FROM planos WHERE id = $1`,
      [targetPlanoId]
    );
    if (tp[0]) {
      intervalo = tp[0].intervalo;
      planoNome = tp[0].nome;
    }
  }

  const fim = periodEndFromInterval(intervalo, paidAt);
  const proxima = new Date(fim);

  await query(
    `UPDATE faturas SET status = 'paga', pago_em = $1 WHERE id = $2`,
    [paidAt, faturaId]
  );

  await query(
    `UPDATE assinaturas
     SET status = 'ativa',
         plano_id = COALESCE($4, plano_id),
         trial_ate = NULL,
         fim_em = $1,
         proxima_cobranca = $2,
         cancelada_em = NULL,
         acesso_ate = NULL,
         updated_at = NOW()
     WHERE id = $3`,
    [fim, proxima, fatura.assinatura_id, targetPlanoId]
  );

  emailPagamentoConfirmado(fatura.usuario_id, { planoNome }).catch(() => {});

  return { ok: true, usuario_id: fatura.usuario_id, plano_nome: planoNome };
}

const OVERDUE_EVENTS = new Set(['PAYMENT_OVERDUE']);
const CANCEL_PAYMENT_EVENTS = new Set(['PAYMENT_DELETED', 'PAYMENT_REFUNDED']);
const IGNORE_AFTER_LOG = new Set(['PAYMENT_CREATED']);

async function resolveFaturaFromWebhook(body) {
  const payment = body.payment || body;
  const paymentId = payment?.id;
  let faturaId = parsePaymentExternalRef(payment?.externalReference);
  if (!faturaId && paymentId) {
    const { rows } = await query(
      `SELECT fatura_id FROM pagamentos WHERE gateway_payment_id = $1 LIMIT 1`,
      [paymentId]
    );
    faturaId = rows[0]?.fatura_id;
  }
  return { payment, paymentId, faturaId };
}

export async function processAsaasWebhook(body) {
  const idempotencyKey = buildWebhookIdempotencyKey(body);
  const evento = body?.event || 'UNKNOWN';

  const ins = await query(
    `INSERT INTO eventos_pagamento (gateway, evento, idempotency_key, payload)
     VALUES ('asaas', $1, $2, $3)
     ON CONFLICT (gateway, idempotency_key) DO NOTHING
     RETURNING id`,
    [evento, idempotencyKey, JSON.stringify(body)]
  );

  if (!ins.rows.length) {
    return { ok: true, duplicate: true, message: 'Evento já processado.' };
  }

  const { payment, paymentId, faturaId } = await resolveFaturaFromWebhook(body);

  if (IGNORE_AFTER_LOG.has(evento)) {
    return { ok: true, logged: true, evento };
  }

  if (OVERDUE_EVENTS.has(evento)) {
    if (faturaId) {
      const { rows: fr } = await query(
        `SELECT usuario_id FROM faturas WHERE id = $1`,
        [faturaId]
      );
      if (fr[0]) {
        await query(
          `UPDATE assinaturas SET status = 'atrasada', updated_at = NOW() WHERE usuario_id = $1 AND status IN ('ativa', 'trial')`,
          [fr[0].usuario_id]
        );
        emailAssinaturaAtrasada(fr[0].usuario_id).catch(() => {});
      }
    }
    return { ok: true, overdue: true, evento, fatura_id: faturaId };
  }

  if (CANCEL_PAYMENT_EVENTS.has(evento)) {
    if (paymentId) {
      const st = evento === 'PAYMENT_REFUNDED' ? 'estornado' : 'cancelado';
      await query(
        `UPDATE pagamentos SET status = $1, payload = payload || $2::jsonb WHERE gateway_payment_id = $3`,
        [
          st,
          JSON.stringify({ webhook: evento, at: new Date().toISOString() }),
          paymentId,
        ]
      );
    }
    if (faturaId) {
      await query(
        `UPDATE faturas SET status = 'cancelada' WHERE id = $1 AND status = 'pendente'`,
        [faturaId]
      );
    }
    return { ok: true, cancelled: true, evento, fatura_id: faturaId };
  }

  if (!PAYMENT_CONFIRM_EVENTS.has(evento)) {
    return { ok: true, ignored: true, evento };
  }

  if (!faturaId) {
    return { ok: false, error: 'Fatura não identificada no webhook.' };
  }

  if (paymentId) {
    await query(
      `UPDATE pagamentos SET status = 'confirmado', payload = payload || $1::jsonb
       WHERE gateway_payment_id = $2`,
      [JSON.stringify({ webhook: evento, confirmedAt: new Date().toISOString() }), paymentId]
    );
  }

  const result = await activateSubscriptionFromPayment(faturaId);
  if (result.usuario_id) await refreshSubscriptionLifecycle(result.usuario_id);
  return { ok: true, activated: true, fatura_id: faturaId, evento };
}

export async function trocarPlano(usuarioId, planoSlug) {
  const plano = await getPlanoBySlug(planoSlug);
  if (!plano) return { ok: false, error: 'Plano não encontrado.' };

  const usuario = await getUsuario(usuarioId);
  if (!planoMatchesTipoPerfil(plano.slug, usuario.tipo_perfil)) {
    return { ok: false, error: 'Plano não disponível para seu perfil (PF/PJ).' };
  }

  const assinatura = await getAssinaturaUsuario(usuarioId);
  const precoAtual = assinatura?.plano?.preco_centavos || 0;
  const statusAtual = assinatura?.status || 'trial';

  if (isDowngrade({
    precoAtualCentavos: precoAtual,
    precoNovoCentavos: plano.preco_centavos,
    slugAtual: assinatura?.plano?.slug,
    slugNovo: plano.slug,
  })) {
    await query(
      `UPDATE assinaturas SET plano_id = $1, updated_at = NOW() WHERE usuario_id = $2`,
      [plano.id, usuarioId]
    );
    const updated = await getAssinaturaUsuario(usuarioId);
    return {
      ok: true,
      tipo: 'downgrade',
      regra: BILLING_RULES_DOC.downgrade,
      message:
        'Downgrade aplicado. O novo valor passa a valer na próxima renovação; não há reembolso do ciclo atual.',
      assinatura: updated,
    };
  }

  if (
    !isUpgrade({
      statusAtual,
      precoAtualCentavos: precoAtual,
      precoNovoCentavos: plano.preco_centavos,
    }) &&
    assinatura?.plano?.slug === plano.slug &&
    statusAtual === 'ativa'
  ) {
    return { ok: false, error: 'Você já está neste plano.' };
  }

  const checkout = await createCheckout(usuarioId, plano.slug);
  if (!checkout.ok) return checkout;
  return {
    ok: true,
    tipo: 'upgrade',
    regra: BILLING_RULES_DOC.upgrade,
    ...checkout,
  };
}

export async function adminReenviarCobranca(alvoUsuarioId, adminUsuarioId) {
  const { rows } = await query(
    `SELECT f.id,
            COALESCE(pg.payload->>'target_plano_slug', pl.slug) AS slug
     FROM faturas f
     JOIN assinaturas a ON a.id = f.assinatura_id
     JOIN planos pl ON pl.id = a.plano_id
     LEFT JOIN LATERAL (
       SELECT payload FROM pagamentos WHERE fatura_id = f.id ORDER BY created_at DESC LIMIT 1
     ) pg ON true
     WHERE f.usuario_id = $1 AND f.status = 'pendente'
     ORDER BY f.created_at DESC LIMIT 1`,
    [alvoUsuarioId]
  );
  if (!rows.length) {
    return { ok: false, error: 'Nenhuma fatura pendente para reenviar.' };
  }
  const checkout = await createCheckout(alvoUsuarioId, rows[0].slug);
  if (!checkout.ok) return checkout;
  await insertAdminSaasAudit({
    adminUsuarioId,
    alvoUsuarioId,
    acao: 'reenviar_cobranca',
    detalhes: { fatura_id: rows[0].id },
  });
  return { ok: true, ...checkout };
}

export async function adminMarcarFaturaPaga(alvoUsuarioId, faturaId, adminUsuarioId) {
  const { rows } = await query(
    `SELECT id, usuario_id, status FROM faturas WHERE id = $1 AND usuario_id = $2`,
    [faturaId, alvoUsuarioId]
  );
  if (!rows.length) return { ok: false, error: 'Fatura não encontrada.' };
  if (rows[0].status === 'paga') {
    return { ok: true, already: true, message: 'Fatura já estava paga.' };
  }
  const result = await activateSubscriptionFromPayment(faturaId);
  await refreshSubscriptionLifecycle(alvoUsuarioId);
  await insertAdminSaasAudit({
    adminUsuarioId,
    alvoUsuarioId,
    acao: 'marcar_pago_manual',
    detalhes: { fatura_id: faturaId },
  });
  const assinatura = await getAssinaturaUsuario(alvoUsuarioId);
  return { ok: true, assinatura, ...result };
}

export async function adminCancelarAssinatura(alvoUsuarioId, adminUsuarioId) {
  const result = await cancelarAssinatura(alvoUsuarioId);
  if (result.ok) {
    await insertAdminSaasAudit({
      adminUsuarioId,
      alvoUsuarioId,
      acao: 'cancelar_assinatura',
      detalhes: {},
    });
    const { rows } = await query(
      `SELECT acesso_ate FROM assinaturas WHERE usuario_id = $1`,
      [alvoUsuarioId]
    );
    emailAssinaturaCancelada(alvoUsuarioId, { acessoAte: rows[0]?.acesso_ate }).catch(() => {});
  }
  return result;
}

export async function listWebhookEventsForUsuario(usuarioId, { limit = 30 } = {}) {
  const { rows } = await query(
    `SELECT e.id, e.evento, e.idempotency_key, e.created_at
     FROM eventos_pagamento e
     WHERE e.payload::text LIKE $1
     ORDER BY e.created_at DESC
     LIMIT $2`,
    [`%${usuarioId}%`, limit]
  );
  return rows;
}

export async function cancelarAssinatura(usuarioId) {
  const { rows } = await query(
    `SELECT id, status, fim_em FROM assinaturas WHERE usuario_id = $1`,
    [usuarioId]
  );
  const sub = rows[0];
  if (!sub) return { ok: false, error: 'Assinatura não encontrada.' };

  const acessoAte = sub.fim_em || new Date();
  await query(
    `UPDATE assinaturas
     SET status = 'cancelada',
         cancelada_em = NOW(),
         acesso_ate = COALESCE(fim_em, NOW() + INTERVAL '30 days'),
         proxima_cobranca = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [sub.id]
  );

  await query(
    `UPDATE faturas SET status = 'cancelada'
     WHERE assinatura_id = $1 AND status = 'pendente'`,
    [sub.id]
  );

  const assinatura = await getAssinaturaUsuario(usuarioId);
  const ateFmt = new Date(acessoAte).toLocaleDateString('pt-BR');
  emailAssinaturaCancelada(usuarioId, { acessoAte }).catch(() => {});
  return {
    ok: true,
    message: `Sua assinatura ficará ativa até ${ateFmt}.`,
    acesso_ate: acessoAte,
    assinatura,
  };
}

export async function listFaturasUsuario(usuarioId, { limit = 50 } = {}) {
  const { rows } = await query(
    `SELECT f.id, f.assinatura_id, f.gateway, f.gateway_invoice_id, f.valor_centavos, f.status,
            f.vencimento, f.pago_em, f.created_at,
            p.gateway_payment_id, p.payload AS pagamento_payload
     FROM faturas f
     LEFT JOIN LATERAL (
       SELECT gateway_payment_id, payload
       FROM pagamentos
       WHERE fatura_id = f.id
       ORDER BY created_at DESC
       LIMIT 1
     ) p ON true
     WHERE f.usuario_id = $1
     ORDER BY f.created_at DESC LIMIT $2`,
    [usuarioId, limit]
  );
  return rows.map((row) => {
    let pix = null;
    let invoice_url = null;
    if (row.pagamento_payload) {
      const pl =
        typeof row.pagamento_payload === 'string'
          ? JSON.parse(row.pagamento_payload)
          : row.pagamento_payload;
      pix = pl?.pix?.copy_paste || pl?.copy_paste || null;
      invoice_url = pl?.pix?.invoice_url || pl?.invoice_url || null;
    }
    const venc = row.vencimento ? new Date(`${row.vencimento}T12:00:00`) : null;
    const hoje = new Date();
    hoje.setHours(12, 0, 0, 0);
    let displayStatus = row.status;
    if (row.status === 'pendente' && venc && venc < hoje) {
      displayStatus = 'atrasado';
    } else if (row.status === 'paga') {
      displayStatus = 'pago';
    }
    return {
      ...row,
      display_status: displayStatus,
      pix_copy_paste: pix,
      invoice_url:
        invoice_url ||
        (row.gateway_invoice_id
          ? `https://www.asaas.com/i/${row.gateway_invoice_id}`
          : null),
    };
  });
}

export async function listPagamentosUsuario(usuarioId, { limit = 50 } = {}) {
  const { rows } = await query(
    `SELECT p.id, p.fatura_id, p.gateway, p.gateway_payment_id, p.valor_centavos,
            p.status, p.created_at, f.vencimento AS fatura_vencimento
     FROM pagamentos p
     JOIN faturas f ON f.id = p.fatura_id
     WHERE p.usuario_id = $1
     ORDER BY p.created_at DESC LIMIT $2`,
    [usuarioId, limit]
  );
  return rows;
}

/** Renovação: gera nova fatura pendente para o ciclo seguinte (chamado após ativação ou job). */
export async function createRenewalInvoice(usuarioId) {
  const { rows } = await query(
    `SELECT a.id AS assinatura_id, a.status, a.proxima_cobranca, p.preco_centavos, p.nome, p.slug
     FROM assinaturas a
     JOIN planos p ON p.id = a.plano_id
     WHERE a.usuario_id = $1`,
    [usuarioId]
  );
  const sub = rows[0];
  if (!sub || sub.status !== 'ativa') return { ok: false, error: 'Assinatura não elegível para renovação.' };
  if (!sub.preco_centavos) return { ok: false, error: 'Plano sem valor de renovação.' };

  const venc = formatDateYmd(sub.proxima_cobranca ? new Date(sub.proxima_cobranca) : addDays(new Date(), 3));
  const { rows: f } = await query(
    `INSERT INTO faturas (usuario_id, assinatura_id, gateway, valor_centavos, status, vencimento)
     VALUES ($1, $2, 'asaas', $3, 'pendente', $4)
     RETURNING id`,
    [usuarioId, sub.assinatura_id, sub.preco_centavos, venc]
  );
  return { ok: true, fatura_id: f[0].id };
}
