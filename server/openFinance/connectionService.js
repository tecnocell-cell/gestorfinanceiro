import { getOpenFinanceConfig } from './config.js';
import { createConnectionViaProvider, getProviderName } from './providerFactory.js';
import { startPluggyConnect, buildPluggyConnectionPayload } from './providers/pluggy.js';
import {
  insertConnection,
  insertAccount,
  listConnections,
  listAccountsByConnection,
} from './repository.js';

export async function getModuleStatus() {
  const config = getOpenFinanceConfig();
  const providerLabel =
    config.provider === 'pluggy' ? 'Pluggy'
      : config.provider === 'belvo' ? 'Belvo'
        : 'Mock (demo)';

  const credentialsMissing = config.provider === 'pluggy' && !config.pluggyReady;

  let message;
  if (config.demoMode) {
    message = 'Modo demonstração: use o Banco Demo Fluxiva para testar o fluxo sem banco real.';
  } else if (config.provider === 'pluggy' && config.pluggyReady) {
    message = 'Open Finance via Pluggy ativo. Clique em "Conectar banco via Pluggy", escolha sua instituição no widget e autorize o acesso.';
  } else if (credentialsMissing) {
    message = 'Open Finance temporariamente indisponível. O administrador do Fluxiva precisa configurar a integração Pluggy no servidor (configuração única, não é por usuário).';
  } else if (config.realProviderConfigured) {
    message = `Provedor ${config.provider} configurado no servidor.`;
  } else {
    message = 'Provedor Open Finance selecionado no servidor, mas ainda não está pronto para uso.';
  }

  return {
    enabled: true,
    provider: config.provider,
    providerLabel,
    demoMode: config.demoMode,
    realProviderConfigured: config.realProviderConfigured,
    pluggyReady: config.pluggyReady,
    belvoReady: config.belvoReady,
    canStartPluggyConnect: config.canStartPluggyConnect,
    credentialsMissing,
    /** Credenciais Pluggy são globais do servidor; nunca por usuário. */
    credentialsScope: 'server',
    message,
  };
}

export async function initPluggyConnectForUser(usuarioId) {
  return startPluggyConnect({ clientUserId: String(usuarioId) });
}

export async function completePluggyConnectionForUser(db, usuarioId, { itemId }) {
  if (!itemId || !String(itemId).trim()) {
    const err = new Error('Campo itemId é obrigatório (retornado pelo Pluggy Connect após autorização).');
    err.status = 400;
    throw err;
  }

  const itemIdStr = String(itemId).trim();
  const existing = await listConnections(db, usuarioId);
  const dup = existing.find((c) => c.provider === 'pluggy' && c.provider_item_id === itemIdStr);
  if (dup) {
    const err = new Error('Esta conexão Pluggy já está vinculada à sua conta.');
    err.status = 409;
    throw err;
  }

  const payload = await buildPluggyConnectionPayload(itemIdStr);

  const connection = await insertConnection(db, usuarioId, {
    provider: payload.provider,
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

  return {
    connection,
    accounts,
    provider: 'pluggy',
    pluggyItemStatus: payload.pluggyItemStatus,
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
