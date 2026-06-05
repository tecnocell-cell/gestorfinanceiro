/**
 * Sandbox PIX Mercado Pago — homologação sem API real (Etapa 7.9)
 */

const registry = new Map();

export const PIX_SANDBOX_SCENARIOS = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  cancelled: 'cancelled',
};

const STATUS_MAP = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  cancelled: 'cancelled',
};

export function mockPixPaymentIdFromScenario(scenario = 'pending') {
  const ts = Date.now();
  const rnd = Math.random().toString(36).slice(2, 8);
  return `pay_mp_pix_${scenario}_${ts}_${rnd}`;
}

export function scenarioFromMockPixPaymentId(paymentId) {
  const id = String(paymentId || '');
  if (id.includes('_pending_')) return 'pending';
  if (id.includes('_approved_')) return 'approved';
  if (id.includes('_rejected_')) return 'rejected';
  if (id.includes('_cancelled_')) return 'cancelled';
  if (id.includes('_pix_')) return 'pending';
  return 'pending';
}

/**
 * @param {{ id: string, status?: string, external_reference?: string, transaction_amount?: number }} payment
 */
export function registerMockPixPayment(payment) {
  const scenario = scenarioFromMockPixPaymentId(payment.id);
  registry.set(payment.id, {
    id: payment.id,
    status: payment.status || STATUS_MAP[scenario] || 'pending',
    external_reference: payment.external_reference || null,
    transaction_amount: payment.transaction_amount ?? null,
    mock: true,
    sandbox: true,
    sandbox_scenario: scenario,
  });
}

export function setMockPixScenario(paymentId, scenario) {
  const entry = registry.get(paymentId);
  if (!entry) return null;
  const st = STATUS_MAP[scenario] || scenario;
  entry.status = st;
  entry.sandbox_scenario = scenario;
  registry.set(paymentId, entry);
  return entry;
}

export function getMockPixPaymentById(paymentId) {
  const id = String(paymentId || '');
  if (!id.includes('_pix_') && !registry.has(id)) return null;

  if (registry.has(id)) {
    return { ...registry.get(id) };
  }

  const scenario = scenarioFromMockPixPaymentId(id);
  return {
    id,
    status: STATUS_MAP[scenario] || 'pending',
    external_reference: null,
    mock: true,
    sandbox: true,
    sandbox_scenario: scenario,
  };
}

export function clearMockPixRegistry() {
  registry.clear();
}
