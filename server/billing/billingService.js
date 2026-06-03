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
      JSON.stringify({ billingType: 'PIX', mock: payment.mock || false }),
    ]
  );

  await query(
    `UPDATE assinaturas SET plano_id = $1, updated_at = NOW() WHERE id = $2`,
    [plano.id, assinaturaId]
  );

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
      invoice_url: payment.invoiceUrl || null,
    },
    plano_slug: plano.slug,
  };
}

export async function activateSubscriptionFromPayment(faturaId, paidAt = new Date()) {
  const { rows } = await query(
    `SELECT f.id, f.usuario_id, f.assinatura_id, f.valor_centavos, f.status,
            a.plano_id, p.intervalo AS plano_intervalo, p.slug AS plano_slug
     FROM faturas f
     JOIN assinaturas a ON a.id = f.assinatura_id
     JOIN planos p ON p.id = a.plano_id
     WHERE f.id = $1`,
    [faturaId]
  );
  const fatura = rows[0];
  if (!fatura) return { ok: false, error: 'Fatura não encontrada.' };
  if (fatura.status === 'paga') return { ok: true, already: true };

  const fim = periodEndFromInterval(fatura.plano_intervalo, paidAt);
  const proxima = new Date(fim);

  await query(
    `UPDATE faturas SET status = 'paga', pago_em = $1 WHERE id = $2`,
    [paidAt, faturaId]
  );

  await query(
    `UPDATE assinaturas
     SET status = 'ativa',
         trial_ate = NULL,
         fim_em = $1,
         proxima_cobranca = $2,
         cancelada_em = NULL,
         acesso_ate = NULL,
         updated_at = NOW()
     WHERE id = $3`,
    [fim, proxima, fatura.assinatura_id]
  );

  return { ok: true, usuario_id: fatura.usuario_id };
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

  if (!PAYMENT_CONFIRM_EVENTS.has(evento)) {
    return { ok: true, ignored: true, evento };
  }

  const payment = body.payment || body;
  const paymentId = payment?.id;
  const externalRef = payment?.externalReference;
  let faturaId = parsePaymentExternalRef(externalRef);

  if (!faturaId && paymentId) {
    const { rows } = await query(
      `SELECT fatura_id FROM pagamentos WHERE gateway_payment_id = $1 LIMIT 1`,
      [paymentId]
    );
    faturaId = rows[0]?.fatura_id;
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
  await refreshSubscriptionLifecycle(result.usuario_id);
  return { ok: true, activated: true, fatura_id: faturaId };
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
  return {
    ok: true,
    message: `Cancelamento registrado. Acesso até ${new Date(acessoAte).toLocaleDateString('pt-BR')}.`,
    assinatura,
  };
}

export async function listFaturasUsuario(usuarioId, { limit = 50 } = {}) {
  const { rows } = await query(
    `SELECT id, assinatura_id, gateway, gateway_invoice_id, valor_centavos, status,
            vencimento, pago_em, created_at
     FROM faturas WHERE usuario_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [usuarioId, limit]
  );
  return rows;
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
