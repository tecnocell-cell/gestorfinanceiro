import { getOpenFinanceConfig, assertProviderOperational } from './config.js';
import { createMockConnection, fetchMockTransactions } from './providers/mock.js';
import { createPluggyConnection, fetchPluggyTransactions } from './providers/pluggy.js';
import { createBelvoConnection, fetchBelvoTransactions } from './providers/belvo.js';

export function getProviderName() {
  return getOpenFinanceConfig().provider;
}

export async function createConnectionViaProvider(opts = {}) {
  const config = getOpenFinanceConfig();
  assertProviderOperational(config);

  switch (config.provider) {
    case 'pluggy':
      return createPluggyConnection(opts);
    case 'belvo':
      return createBelvoConnection(opts);
    case 'mock':
    default:
      return createMockConnection(opts);
  }
}

export async function fetchTransactionsViaProvider(connectionRow, accountsRows) {
  const config = getOpenFinanceConfig();
  assertProviderOperational(config);

  const connection = {
    id: connectionRow.id,
    provider: connectionRow.provider,
    provider_item_id: connectionRow.provider_item_id,
    accounts: accountsRows,
  };

  switch (config.provider) {
    case 'pluggy':
      return fetchPluggyTransactions(connection);
    case 'belvo':
      return fetchBelvoTransactions(connection);
    case 'mock':
    default:
      return fetchMockTransactions(connection);
  }
}
