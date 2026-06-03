import { getOpenFinanceConfig } from './config.js';
import { createConnectionViaProvider, getProviderName } from './providerFactory.js';
import {
  insertConnection,
  insertAccount,
  listConnections,
  listAccountsByConnection,
} from './repository.js';

export async function getModuleStatus() {
  const config = getOpenFinanceConfig();
  return {
    enabled: true,
    provider: config.provider,
    demoMode: config.demoMode,
    realProviderConfigured: config.realProviderConfigured,
    pluggyReady: config.pluggyReady,
    belvoReady: config.belvoReady,
    message: config.demoMode
      ? 'Modo demonstração (mock). Credenciais Pluggy/Belvo não são necessárias.'
      : config.realProviderConfigured
        ? `Provider ${config.provider} configurado.`
        : `Provider ${config.provider} selecionado, mas credenciais incompletas. Use mock em desenvolvimento.`,
  };
}

export async function createMockConnectionForUser(db, usuarioId, body = {}) {
  const config = getOpenFinanceConfig();
  if (config.provider !== 'mock') {
    const err = new Error(
      'Conexão demo disponível apenas com OPENFINANCE_PROVIDER=mock. Para produção, configure Pluggy ou Belvo.'
    );
    err.status = 422;
    throw err;
  }

  const payload = await createConnectionViaProvider({
    institutionName: body.institutionName,
  });

  const connection = await insertConnection(db, usuarioId, {
    provider: payload.provider || 'mock',
    institutionName: payload.institutionName,
    status: payload.status,
    consentId: payload.consentId,
    providerItemId: payload.providerItemId,
  });

  const accounts = [];
  for (const acc of payload.accounts || []) {
    const row = await insertAccount(db, connection.id, acc);
    accounts.push(row);
  }

  return { connection, accounts, provider: getProviderName() };
}

export async function getConnectionsWithAccounts(db, usuarioId) {
  const connections = await listConnections(db, usuarioId);
  const out = [];
  for (const c of connections) {
    const accounts = await listAccountsByConnection(db, c.id);
    out.push({
      id: c.id,
      provider: c.provider,
      institutionName: c.institution_name,
      status: c.status,
      consentId: c.consent_id,
      providerItemId: c.provider_item_id,
      accountsCount: c.accounts_count,
      transactionsCount: c.transactions_count,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      accounts: accounts.map((a) => ({
        id: a.id,
        accountIdProvider: a.account_id_provider,
        name: a.name,
        type: a.type,
        balance: Number(a.balance),
        currency: a.currency,
      })),
    });
  }
  return out;
}
