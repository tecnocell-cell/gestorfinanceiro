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
  const connectionProvider = connectionRow.provider || getOpenFinanceConfig().provider;
  const config = getOpenFinanceConfig();

  if (connectionProvider === 'mock') {
    return fetchMockTransactions({
      id: connectionRow.id,
      accounts: accountsRows,
    });
  }

  assertProviderOperational(config);

  const connection = {
    id: connectionRow.id,
    provider: connectionProvider,
    provider_item_id: connectionRow.provider_item_id,
    accounts: accountsRows,
  };

  switch (connectionProvider) {
    case 'pluggy':
      return fetchPluggyTransactions(connection);
    case 'belvo':
      return fetchBelvoTransactions(connection);
    case 'mock':
    default:
      return fetchMockTransactions(connection);
  }
}
