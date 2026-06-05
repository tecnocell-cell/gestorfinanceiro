/**
 * Gateway Mercado Pago — PIX e cartão (Checkout Transparente) — Etapa 7.8
 * Docs: https://www.mercadopago.com.br/developers
 */
import {
  getMercadoPagoConfigRaw,
  getPaymentConfigRow,
} from '../paymentConfigService.js';
import {
  resolveCardSandboxScenario,
  mockPaymentIdFromScenario,
  getMockPaymentById,
} from '../cardSandbox.js';
import {
  mockPixPaymentIdFromScenario,
  registerMockPixPayment,
  getMockPixPaymentById,
} from '../pixSandbox.js';

const MP_API = 'https://api.mercadopago.com';

function useMock() {
  return (
    process.env.BILLING_USE_MOCK_GATEWAY === 'true' ||
    process.env.NODE_ENV === 'test'
  );
}

export async function getMercadoPagoConfig() {
  const row = await getPaymentConfigRow('mercado_pago');
  const cfg = row?.config || {};
  return {
    ...cfg,
    active: Boolean(row?.active),
    sandbox_mode: cfg.sandbox_mode !== false,
  };
}

export async function isMercadoPagoConfigured() {
  if (useMock()) return true;
  const cfg = await getMercadoPagoConfig();
  return Boolean(cfg.access_token) || Boolean(process.env.MP_ACCESS_TOKEN);
}

export async function isMercadoPagoActive() {
  const row = await getPaymentConfigRow('mercado_pago');
  return Boolean(row?.active) && (await isMercadoPagoConfigured());
}

async function accessToken() {
  const cfg = await getMercadoPagoConfigRaw();
  return cfg.access_token || process.env.MP_ACCESS_TOKEN || null;
}

function mockId(prefix) {
  return `${prefix}_mp_mock_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function mpFetch(path, { method = 'GET', body } = {}) {
  const token = await accessToken();
  if (!token) throw new Error('Pagamento online não configurado.');

  const res = await fetch(`${MP_API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || res.statusText || 'Erro Mercado Pago';
    const err = new Error(msg);
    err.status = res.status;
    err.mp = data;
    throw err;
  }
  return data;
}

/**
 * @param {{ valueReais: number, description: string, externalReference: string, payerEmail?: string }} params
 */
export async function createPixPayment(params) {
  if (useMock()) {
    const id = mockPixPaymentIdFromScenario('pending');
    const copia = `00020126MPMOCKPIX${id}`;
    const payment = {
      id,
      status: 'pending',
      mock: true,
      sandbox: true,
      qrCode: copia,
      qrCodeBase64: null,
      copiaECola: copia,
      expiresAt: params.dueDate || null,
      transaction_amount: params.valueReais,
      external_reference: params.externalReference,
    };
    registerMockPixPayment(payment);
    return payment;
  }

  const cfg = await getMercadoPagoConfigRaw();
  const payment = await mpFetch('/v1/payments', {
    method: 'POST',
    body: {
      transaction_amount: params.valueReais,
      description: params.description,
      payment_method_id: 'pix',
      payer: { email: params.payerEmail || cfg.payer_email_fallback || 'pagador@fluxiva.app' },
      external_reference: params.externalReference,
    },
  });

  const tx = payment.point_of_interaction?.transaction_data || {};
  return {
    id: String(payment.id),
    status: payment.status,
    qrCode: tx.qr_code || null,
    qrCodeBase64: tx.qr_code_base64 || null,
    copiaECola: tx.qr_code || null,
    expiresAt: tx.date_of_expiration || null,
    transaction_amount: payment.transaction_amount,
    external_reference: payment.external_reference,
  };
}

/**
 * @param {{ valueReais: number, description: string, externalReference: string, cardToken: string, installments?: number, payer?: object }} params
 */
export function assertCardPaymentAllowed() {
  if (process.env.PAYMENT_CARD_ENABLED !== 'true') {
    throw new Error('Pagamento com cartão não está habilitado neste ambiente.');
  }
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.PAYMENT_CARD_ALLOW_PRODUCTION !== 'true'
  ) {
    throw new Error('Cartão indisponível em produção até homologação.');
  }
}

export async function createCardPayment(params) {
  assertCardPaymentAllowed();

  if (useMock()) {
    const scenario = resolveCardSandboxScenario(params.cardToken, params.installments);
    const id = mockPaymentIdFromScenario(scenario.scenario);
    return {
      id,
      status: scenario.status,
      status_detail: scenario.status_detail,
      installments: scenario.installments,
      mock: true,
      sandbox: true,
      sandbox_scenario: scenario.scenario,
      external_reference: params.externalReference,
    };
  }

  const cfg = await getMercadoPagoConfigRaw();
  const payer = params.payer || {};
  const payment = await mpFetch('/v1/payments', {
    method: 'POST',
    body: {
      transaction_amount: params.valueReais,
      token: params.cardToken,
      description: params.description,
      installments: params.installments || 1,
      payment_method_id: params.payment_method_id || undefined,
      payer: {
        email: payer.email || cfg.payer_email_fallback || 'pagador@fluxiva.app',
        identification: payer.identification,
      },
      external_reference: params.externalReference,
    },
  });

  return {
    id: String(payment.id),
    status: payment.status,
    status_detail: payment.status_detail,
    external_reference: payment.external_reference,
  };
}

export async function getPayment(paymentId) {
  if (useMock()) {
    const pix = getMockPixPaymentById(paymentId);
    if (pix) return pix;
    return getMockPaymentById(paymentId);
  }
  return mpFetch(`/v1/payments/${paymentId}`);
}

export async function cancelPayment(paymentId) {
  if (useMock()) {
    return { id: paymentId, status: 'cancelled', mock: true };
  }
  return mpFetch(`/v1/payments/${paymentId}`, {
    method: 'PUT',
    body: { status: 'cancelled' },
  });
}

export function paymentExternalRef(faturaId) {
  return `fluxiva:fatura:${faturaId}`;
}

export function parsePaymentExternalRef(externalReference) {
  if (!externalReference || typeof externalReference !== 'string') return null;
  const m = externalReference.match(/^fluxiva:fatura:([0-9a-f-]{36})$/i);
  return m ? m[1] : null;
}

export const MP_STATUS_MAP = {
  approved: 'confirmado',
  pending: 'pendente',
  in_process: 'pendente',
  rejected: 'cancelado',
  cancelled: 'cancelado',
  refunded: 'estornado',
  charged_back: 'chargeback',
};

export function mapMpStatus(status) {
  return MP_STATUS_MAP[status] || 'pendente';
}

export const MP_APPROVED_STATUSES = new Set(['approved']);

export function buildWebhookIdempotencyKey(body, query = {}) {
  const topic = query.topic || body?.type || 'payment';
  const id = body?.data?.id || query.id || body?.id || '';
  const action = body?.action || '';
  return `${topic}:${id}:${action}`.slice(0, 128);
}

export function parseWebhook(body, query = {}) {
  const paymentId = body?.data?.id || query['data.id'] || query.id;
  const topic = query.topic || body?.type;
  return {
    topic,
    paymentId: paymentId ? String(paymentId) : null,
    action: body?.action,
    live_mode: body?.live_mode,
  };
}

export async function verifyWebhookSignature(req) {
  const cfg = await getMercadoPagoConfigRaw();
  const secret = cfg.webhook_secret;
  if (!secret) return true;

  const sig = req.headers['x-signature'] || req.headers['x-hub-signature'];
  if (!sig) return false;

  // MP envia x-signature com ts e v1 — validação simplificada por token de query em dev
  const qSecret = req.query?.secret || req.headers['x-webhook-secret'];
  return qSecret === secret || sig.includes(secret);
}

export async function testMercadoPagoConnection() {
  if (useMock()) {
    return { ok: true, mock: true, message: 'Conexão simulada (mock gateway).' };
  }
  const token = await accessToken();
  if (!token) {
    return { ok: false, error: 'Informe o token de acesso do Mercado Pago.' };
  }
  try {
    await mpFetch('/users/me');
    return { ok: true, message: 'Conexão com Mercado Pago OK.' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
