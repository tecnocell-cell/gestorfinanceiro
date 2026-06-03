import { randomUUID } from 'crypto';

const DEMO_INSTITUTION = 'Banco Demo Fluxiva';

/** Transações fixas do mock — mesmas em toda sincronização (dedup via fingerprint). */
export function getMockTransactionsForConnection(connectionId) {
  const suffix = String(connectionId).slice(0, 8);
  return [
    {
      transactionId: `mock-demo-in-${suffix}`,
      date: '2026-06-01',
      description: 'PIX recebido — demo Open Finance',
      amount: 1500.5,
    },
    {
      transactionId: `mock-demo-out-${suffix}`,
      date: '2026-06-02',
      description: 'Pagamento fornecedor — demo Open Finance',
      amount: -320.75,
    },
    {
      transactionId: `mock-demo-in2-${suffix}`,
      date: '2026-06-03',
      description: 'Transferência recebida — demo',
      amount: 89.9,
    },
  ];
}

export async function createMockConnection({ institutionName } = {}) {
  const connectionId = randomUUID();
  const providerItemId = `mock-item-${connectionId}`;

  return {
    provider: 'mock',
    institutionName: institutionName || DEMO_INSTITUTION,
    status: 'active',
    consentId: `mock-consent-${connectionId}`,
    providerItemId,
    accounts: [
      {
        accountIdProvider: `mock-cc-${connectionId}`,
        name: 'Conta Corrente Demo',
        type: 'checking',
        balance: 5420.3,
        currency: 'BRL',
      },
      {
        accountIdProvider: `mock-sav-${connectionId}`,
        name: 'Poupança Demo',
        type: 'savings',
        balance: 12000,
        currency: 'BRL',
      },
    ],
  };
}

export async function fetchMockTransactions(connection) {
  const accounts = connection.accounts || [];
  const primary = accounts[0];
  if (!primary) return [];

  const txs = getMockTransactionsForConnection(connection.id);
  return txs.map((tx) => ({
    ...tx,
    accountIdProvider: primary.account_id_provider || primary.accountIdProvider,
  }));
}
