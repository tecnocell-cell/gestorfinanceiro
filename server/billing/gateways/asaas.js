/**
 * Gateway Asaas — PIX e webhooks (Etapa 6.5)
 * Docs: https://docs.asaas.com/
 */

const SANDBOX_BASE = 'https://sandbox.asaas.com/api/v3';
const PRODUCTION_BASE = 'https://api.asaas.com/api/v3';

function useMock() {
  return (
    process.env.BILLING_USE_MOCK_GATEWAY === 'true' ||
    (!process.env.ASAAS_API_KEY && process.env.NODE_ENV !== 'production')
  );
}

export function isAsaasConfigured() {
  return Boolean(process.env.ASAAS_API_KEY) || useMock();
}

export function getAsaasEnv() {
  const env = (process.env.ASAAS_ENV || 'sandbox').toLowerCase();
  return env === 'production' ? 'production' : 'sandbox';
}

function baseUrl() {
  if (useMock()) return null;
  return getAsaasEnv() === 'production' ? PRODUCTION_BASE : SANDBOX_BASE;
}

async function asaasFetch(path, { method = 'GET', body } = {}) {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new Error('ASAAS_API_KEY não configurada.');

  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      access_token: key,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data?.errors?.[0]?.description || data?.message || res.statusText || 'Erro Asaas';
    const err = new Error(msg);
    err.status = res.status;
    err.asaas = data;
    throw err;
  }
  return data;
}

function mockId(prefix) {
  return `${prefix}_mock_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * @param {{ name: string, email: string, cpfCnpj?: string, externalReference: string }} customer
 */
export async function createOrGetCustomer(customer) {
  if (useMock()) {
    return { id: mockId('cus'), ...customer, mock: true };
  }

  const existing = await asaasFetch(
    `/customers?externalReference=${encodeURIComponent(customer.externalReference)}&limit=1`
  );
  if (existing?.data?.[0]?.id) return existing.data[0];

  return asaasFetch('/customers', {
    method: 'POST',
    body: {
      name: customer.name,
      email: customer.email,
      cpfCnpj: customer.cpfCnpj || undefined,
      externalReference: customer.externalReference,
      notificationDisabled: true,
    },
  });
}

/**
 * @param {{ customerId: string, valueReais: number, dueDate: string, description: string, externalReference: string }} params
 */
export async function createPixPayment(params) {
  if (useMock()) {
    const paymentId = mockId('pay');
    return {
      id: paymentId,
      status: 'PENDING',
      billingType: 'PIX',
      invoiceUrl: null,
      bankSlipUrl: null,
      pixQrCodeId: mockId('pixqr'),
      encodedImage: null,
      payload: `00020126MOCKPIX${paymentId}`,
      expirationDate: params.dueDate,
      externalReference: params.externalReference,
      mock: true,
    };
  }

  const payment = await asaasFetch('/payments', {
    method: 'POST',
    body: {
      customer: params.customerId,
      billingType: 'PIX',
      value: params.valueReais,
      dueDate: params.dueDate,
      description: params.description,
      externalReference: params.externalReference,
    },
  });

  let pix = {};
  try {
    pix = await asaasFetch(`/payments/${payment.id}/pixQrCode`);
  } catch {
    /* QR pode demorar; checkout usa invoiceUrl como fallback */
  }

  return {
    ...payment,
    encodedImage: pix.encodedImage || null,
    payload: pix.payload || null,
    expirationDate: pix.expirationDate || params.dueDate,
  };
}

export async function getPayment(paymentId) {
  if (useMock()) {
    return { id: paymentId, status: 'PENDING', mock: true };
  }
  return asaasFetch(`/payments/${paymentId}`);
}

/** Cancela cobrança no sandbox/produção (Etapa 7.2 — test:asaas). */
export async function cancelPayment(paymentId) {
  if (useMock()) {
    return { id: paymentId, status: 'CANCELLED', deleted: true, mock: true };
  }
  if (getAsaasEnv() === 'production' && process.env.ASAAS_ALLOW_CANCEL_PRODUCTION !== 'true') {
    throw new Error('Cancelamento em produção bloqueado (use sandbox ou ASAAS_ALLOW_CANCEL_PRODUCTION).');
  }
  return asaasFetch(`/payments/${paymentId}`, { method: 'DELETE' });
}

export function isAsaasRealKeyConfigured() {
  return Boolean(process.env.ASAAS_API_KEY) && process.env.BILLING_USE_MOCK_GATEWAY !== 'true';
}

export function isWebhookConfigured() {
  return Boolean(process.env.ASAAS_WEBHOOK_TOKEN);
}

export function paymentExternalRef(faturaId) {
  return `fluxiva:fatura:${faturaId}`;
}

export function parsePaymentExternalRef(externalReference) {
  if (!externalReference || typeof externalReference !== 'string') return null;
  const m = externalReference.match(/^fluxiva:fatura:([0-9a-f-]{36})$/i);
  return m ? m[1] : null;
}

/** Eventos que confirmam pagamento */
export const PAYMENT_CONFIRM_EVENTS = new Set([
  'PAYMENT_RECEIVED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED_IN_CASH',
]);

export function buildWebhookIdempotencyKey(body) {
  const event = body?.event || 'unknown';
  const payId = body?.payment?.id || body?.id || '';
  const date = body?.dateCreated || body?.payment?.dateCreated || '';
  return `${event}:${payId}:${date}`.slice(0, 128);
}

export function verifyWebhookToken(req) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected) return true;
  const header = req.headers['asaas-access-token'] || req.headers['x-asaas-access-token'];
  const query = req.query?.token;
  return header === expected || query === expected;
}
