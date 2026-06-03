/**
 * Configuração Open Finance — provider por ENV.
 */
const VALID_PROVIDERS = ['mock', 'pluggy', 'belvo'];

export function getOpenFinanceConfig() {
  const raw = String(process.env.OPENFINANCE_PROVIDER || 'mock').toLowerCase().trim();
  const provider = VALID_PROVIDERS.includes(raw) ? raw : 'mock';

  const clientId = process.env.OPENFINANCE_CLIENT_ID || '';
  const clientSecret = process.env.OPENFINANCE_CLIENT_SECRET || '';
  const baseUrl = process.env.OPENFINANCE_BASE_URL || '';

  const hasCredentials = Boolean(clientId && clientSecret);

  return {
    provider,
    clientId,
    clientSecret,
    baseUrl,
    demoMode: provider === 'mock',
    pluggyReady: provider === 'pluggy' && hasCredentials && Boolean(baseUrl),
    belvoReady: provider === 'belvo' && hasCredentials && Boolean(baseUrl),
    realProviderConfigured:
      (provider === 'pluggy' || provider === 'belvo') && hasCredentials,
  };
}

export function assertProviderOperational(config) {
  if (config.provider === 'mock') return;
  if (config.provider === 'pluggy' && config.pluggyReady) return;
  if (config.provider === 'belvo' && config.belvoReady) return;

  const err = new Error(
    `Provider Open Finance "${config.provider}" não configurado. Defina OPENFINANCE_CLIENT_ID, OPENFINANCE_CLIENT_SECRET e OPENFINANCE_BASE_URL, ou use OPENFINANCE_PROVIDER=mock.`
  );
  err.status = 503;
  throw err;
}
