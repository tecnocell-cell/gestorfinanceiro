import { getOpenFinanceConfig } from '../config.js';
import {
  createPluggyConnectToken,
  fetchPluggyItem,
  fetchPluggyAccountsByItem,
  fetchPluggyTransactionsByAccount,
} from './pluggyHttp.js';

const ACTIVE_ITEM_STATUSES = new Set(['UPDATED', 'LOGIN_SUCCEEDED', 'OUTDATED']);

function mapAccountType(pluggyType) {
  const t = String(pluggyType || '').toUpperCase();
  if (t.includes('CREDIT')) return 'credit';
  if (t.includes('SAV')) return 'savings';
  return 'checking';
}

function mapAccount(acc) {
  const balance = Number(acc.balance ?? acc.currentBalance ?? 0);
  return {
    accountIdProvider: String(acc.id),
    name: acc.name || acc.marketingName || 'Conta',
    type: mapAccountType(acc.type || acc.subtype),
    balance: Number.isFinite(balance) ? balance : 0,
    currency: acc.currencyCode || acc.currency || 'BRL',
  };
}

function mapTransaction(tx, accountIdProvider) {
  const amount = Number(tx.amount ?? tx.value ?? 0);
  const rawDate = tx.date || tx.postedDate || tx.createdAt;
  const date = rawDate ? String(rawDate).slice(0, 10) : new Date().toISOString().slice(0, 10);
  return {
    transactionId: String(tx.id),
    date,
    description: tx.description || tx.merchant?.name || tx.category || 'Transação',
    amount,
    accountIdProvider: String(accountIdProvider),
  };
}

function institutionLabel(item) {
  return (
    item?.connector?.name
    || item?.institution?.name
    || item?.institutionName
    || 'Instituição conectada'
  );
}

function itemStatusToConnectionStatus(item) {
  const st = String(item?.status || '').toUpperCase();
  if (ACTIVE_ITEM_STATUSES.has(st)) return 'active';
  if (st === 'WAITING_USER_INPUT' || st === 'CREATED') return 'pendente';
  if (st === 'LOGIN_ERROR' || st === 'OUTDATED') return 'erro';
  return 'pendente';
}

/**
 * Inicia fluxo Pluggy Connect — retorna connect token (uso no widget).
 */
export async function startPluggyConnect({ clientUserId } = {}) {
  const cfg = getOpenFinanceConfig();
  if (cfg.provider !== 'pluggy') {
    const err = new Error('Conexão Pluggy disponível apenas com OPENFINANCE_PROVIDER=pluggy.');
    err.status = 422;
    throw err;
  }
  if (!cfg.pluggyReady) {
    const err = new Error(
      'Credenciais Pluggy incompletas. Configure OPENFINANCE_CLIENT_ID, OPENFINANCE_CLIENT_SECRET e OPENFINANCE_BASE_URL no servidor.'
    );
    err.status = 503;
    err.code = 'PLUGGY_CREDENTIALS_MISSING';
    throw err;
  }

  const connectToken = await createPluggyConnectToken({
    clientUserId,
    oauthRedirectUrl: process.env.OPENFINANCE_OAUTH_REDIRECT_URL || undefined,
    webhookUrl: process.env.OPENFINANCE_WEBHOOK_URL || undefined,
    avoidDuplicates: true,
  });

  return {
    provider: 'pluggy',
    connectToken,
    expiresInMinutes: 30,
  };
}

/**
 * Após sucesso do widget, materializa conexão + contas no banco local.
 */
export async function buildPluggyConnectionPayload(itemId) {
  const cfg = getOpenFinanceConfig();
  if (!cfg.pluggyReady) {
    const err = new Error('Pluggy não configurado no servidor.');
    err.status = 503;
    throw err;
  }

  const item = await fetchPluggyItem(itemId);
  const accountsRaw = await fetchPluggyAccountsByItem(itemId);
  const accounts = accountsRaw.map(mapAccount);

  if (!accounts.length) {
    const err = new Error('Item Pluggy sem contas disponíveis. Aguarde a atualização do item e tente novamente.');
    err.status = 422;
    throw err;
  }

  return {
    provider: 'pluggy',
    institutionName: institutionLabel(item),
    status: itemStatusToConnectionStatus(item),
    consentId: item?.consentId ? String(item.consentId) : null,
    providerItemId: String(itemId),
    accounts,
    pluggyItemStatus: item?.status || null,
  };
}

/** Legado do factory — não cria conexão direta; use startPluggyConnect + buildPluggyConnectionPayload. */
export async function createPluggyConnection() {
  return startPluggyConnect();
}

/**
 * Busca transações reais na Pluggy para todas as contas da conexão.
 */
export async function fetchPluggyTransactions(connection) {
  const cfg = getOpenFinanceConfig();
  if (!cfg.pluggyReady) {
    const err = new Error('Pluggy não configurado para sincronização.');
    err.status = 503;
    throw err;
  }

  const accounts = connection.accounts || [];
  if (!accounts.length) return [];

  const to = new Date().toISOString().slice(0, 10);
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 90);
  const from = fromDate.toISOString().slice(0, 10);

  const all = [];
  for (const acc of accounts) {
    const providerAccountId = acc.account_id_provider || acc.accountIdProvider;
    if (!providerAccountId) continue;

    const txs = await fetchPluggyTransactionsByAccount(providerAccountId, { from, to });
    for (const tx of txs) {
      all.push(mapTransaction(tx, providerAccountId));
    }
  }

  return all;
}
