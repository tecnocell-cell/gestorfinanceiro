import { getOpenFinanceConfig } from '../config.js';

let cachedApiKey = null;
let cachedApiKeyExpiresAt = 0;

function normalizeBaseUrl(url) {
  return String(url || '').replace(/\/+$/, '');
}

function cfgOrThrow() {
  const cfg = getOpenFinanceConfig();
  if (!cfg.pluggyReady) {
    const err = new Error(
      'Pluggy não configurado. Defina OPENFINANCE_PROVIDER=pluggy, OPENFINANCE_CLIENT_ID, OPENFINANCE_CLIENT_SECRET e OPENFINANCE_BASE_URL.'
    );
    err.status = 503;
    err.code = 'PLUGGY_NOT_CONFIGURED';
    throw err;
  }
  return cfg;
}

async function parseJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.message || data.error || data.detail || res.statusText || 'Erro na API Pluggy';
    const err = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
    err.pluggy = data;
    throw err;
  }
  return data;
}

export async function getPluggyApiKey() {
  const cfg = cfgOrThrow();
  const now = Date.now();
  if (cachedApiKey && now < cachedApiKeyExpiresAt - 60_000) {
    return { apiKey: cachedApiKey, baseUrl: normalizeBaseUrl(cfg.baseUrl) };
  }

  const baseUrl = normalizeBaseUrl(cfg.baseUrl);
  const res = await fetch(`${baseUrl}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
    }),
  });
  const data = await parseJson(res);
  const apiKey = data.apiKey || data.accessToken;
  if (!apiKey) {
    const err = new Error('Resposta de autenticação Pluggy sem apiKey.');
    err.status = 502;
    throw err;
  }

  cachedApiKey = apiKey;
  const ttlMs = (data.expiresIn ? Number(data.expiresIn) * 1000 : 2 * 60 * 60 * 1000);
  cachedApiKeyExpiresAt = now + ttlMs;

  return { apiKey, baseUrl };
}

export async function pluggyRequest(path, { method = 'GET', body } = {}) {
  const { apiKey, baseUrl } = await getPluggyApiKey();
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return parseJson(res);
}

export async function createPluggyConnectToken(options = {}) {
  const payload = {};
  if (options.clientUserId) payload.clientUserId = String(options.clientUserId);
  if (options.webhookUrl) payload.webhookUrl = options.webhookUrl;
  if (options.oauthRedirectUrl) payload.oauthRedirectUrl = options.oauthRedirectUrl;
  if (options.avoidDuplicates != null) payload.avoidDuplicates = options.avoidDuplicates;

  const data = await pluggyRequest('/connect_token', { method: 'POST', body: payload });
  const connectToken = data.accessToken || data.connectToken;
  if (!connectToken) {
    const err = new Error('Resposta Pluggy connect_token sem accessToken.');
    err.status = 502;
    throw err;
  }
  return connectToken;
}

export async function fetchPluggyItem(itemId) {
  return pluggyRequest(`/items/${encodeURIComponent(itemId)}`);
}

export async function fetchPluggyAccountsByItem(itemId) {
  const data = await pluggyRequest(`/accounts?itemId=${encodeURIComponent(itemId)}`);
  return data.results || data.data || (Array.isArray(data) ? data : []);
}

export async function fetchPluggyTransactionsByAccount(accountId, { from, to, pageSize = 500 } = {}) {
  const params = new URLSearchParams({ accountId: String(accountId), pageSize: String(pageSize) });
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const data = await pluggyRequest(`/transactions?${params.toString()}`);
  return data.results || data.data || (Array.isArray(data) ? data : []);
}

/** Limpa cache de API key (útil em testes). */
export function resetPluggyAuthCache() {
  cachedApiKey = null;
  cachedApiKeyExpiresAt = 0;
}
