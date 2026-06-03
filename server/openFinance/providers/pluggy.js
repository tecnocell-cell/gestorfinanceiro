import { getOpenFinanceConfig } from '../config.js';

/**
 * Adapter Pluggy — preparado por ENV; implementação real fora do MVP.
 */
export async function createPluggyConnection() {
  const cfg = getOpenFinanceConfig();
  const err = new Error(
    'Provider Pluggy: configure OPENFINANCE_CLIENT_ID, OPENFINANCE_CLIENT_SECRET e OPENFINANCE_BASE_URL. Use OPENFINANCE_PROVIDER=mock para desenvolvimento.'
  );
  err.status = 503;
  err.provider = 'pluggy';
  err.configured = cfg.pluggyReady;
  throw err;
}

export async function fetchPluggyTransactions() {
  const err = new Error('Provider Pluggy não implementado neste MVP.');
  err.status = 501;
  throw err;
}
