/**
 * Sandbox de cartão Mercado Pago — homologação sem API real (Etapa 7.8A)
 * Tokens mock simulam cenários de aprovação, recusa, parcelamento e cancelamento.
 */

export const CARD_SANDBOX_TOKENS = {
  approved: 'mock_mp_card_approved',
  rejected: 'mock_mp_card_rejected',
  installments: 'mock_mp_card_installments',
  cancelled: 'mock_mp_card_cancelled',
};

const TOKEN_STATUS = {
  [CARD_SANDBOX_TOKENS.approved]: 'approved',
  [CARD_SANDBOX_TOKENS.rejected]: 'rejected',
  [CARD_SANDBOX_TOKENS.installments]: 'approved',
  [CARD_SANDBOX_TOKENS.cancelled]: 'cancelled',
};

/**
 * @param {string} cardToken
 * @param {number} [installments]
 * @returns {{ status: string, status_detail: string, installments: number, scenario: string }}
 */
export function resolveCardSandboxScenario(cardToken, installments = 1) {
  const token = String(cardToken || '').trim().toLowerCase();
  const inst = Math.max(1, Number(installments) || 1);

  if (token === CARD_SANDBOX_TOKENS.rejected || token.includes('rejected') || token.includes('recusado')) {
    return { status: 'rejected', status_detail: 'cc_rejected_other', installments: 1, scenario: 'rejected' };
  }
  if (token === CARD_SANDBOX_TOKENS.cancelled || token.includes('cancelled') || token.includes('cancelado')) {
    return { status: 'cancelled', status_detail: 'by_user', installments: 1, scenario: 'cancelled' };
  }
  if (
    token === CARD_SANDBOX_TOKENS.installments ||
    token.includes('installment') ||
    token.includes('parcelado') ||
    inst > 1
  ) {
    const n = token === CARD_SANDBOX_TOKENS.installments ? 3 : inst;
    return { status: 'approved', status_detail: 'accredited', installments: n, scenario: 'installments' };
  }
  if (token === CARD_SANDBOX_TOKENS.approved || token.includes('approved') || token.includes('aprovado')) {
    return { status: 'approved', status_detail: 'accredited', installments: inst, scenario: 'approved' };
  }

  return { status: 'approved', status_detail: 'accredited', installments: inst, scenario: 'approved' };
}

export function mockPaymentIdFromScenario(scenario) {
  const ts = Date.now();
  const rnd = Math.random().toString(36).slice(2, 8);
  return `pay_mp_mock_${scenario}_${ts}_${rnd}`;
}

export function scenarioFromMockPaymentId(paymentId) {
  const id = String(paymentId || '');
  if (id.includes('_rejected_')) return 'rejected';
  if (id.includes('_cancelled_')) return 'cancelled';
  if (id.includes('_installments_')) return 'installments';
  if (id.includes('_approved_')) return 'approved';
  return 'approved';
}

export function getMockPaymentById(paymentId) {
  const scenario = scenarioFromMockPaymentId(paymentId);
  const statusMap = {
    approved: 'approved',
    installments: 'approved',
    rejected: 'rejected',
    cancelled: 'cancelled',
  };
  const installments = scenario === 'installments' ? 3 : 1;
  return {
    id: paymentId,
    status: statusMap[scenario] || 'approved',
    status_detail: scenario === 'rejected' ? 'cc_rejected_other' : 'accredited',
    installments,
    mock: true,
    sandbox_scenario: scenario,
  };
}

export function isCardSandboxToken(cardToken) {
  const t = String(cardToken || '').toLowerCase();
  return Object.values(CARD_SANDBOX_TOKENS).some((v) => v === t) || t.startsWith('mock_mp_card_');
}
