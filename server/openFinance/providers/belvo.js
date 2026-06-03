import { getOpenFinanceConfig } from '../config.js';

/**
 * Adapter Belvo — preparado por ENV; implementação real fora do MVP.
 */
export async function createBelvoConnection() {
  const cfg = getOpenFinanceConfig();
  const err = new Error(
    'Provider Belvo: configure OPENFINANCE_CLIENT_ID, OPENFINANCE_CLIENT_SECRET e OPENFINANCE_BASE_URL. Use OPENFINANCE_PROVIDER=mock para desenvolvimento.'
  );
  err.status = 503;
  err.provider = 'belvo';
  err.configured = cfg.belvoReady;
  throw err;
}

export async function fetchBelvoTransactions() {
  const err = new Error('Provider Belvo não implementado neste MVP.');
  err.status = 501;
  throw err;
}
