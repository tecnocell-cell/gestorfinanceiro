import { reaisToCentavos } from '../utils/money.js';
import { gerarFingerprintOpenFinance } from './fingerprint.js';
import { fetchTransactionsViaProvider } from './providerFactory.js';
import {
  findConnection,
  listAccountsByConnection,
  findTransactionByFingerprint,
  insertTransaction,
  insertSyncLog,
  touchConnection,
} from './repository.js';
import {
  buildOpenFinanceLancamento,
  appendOpenFinanceLancamentos,
  prepareSyncContext,
} from './lancamentoWriter.js';

function mapProviderTx(raw, accountRow) {
  const amount = Number(raw.amount);
  const absCents = reaisToCentavos(Math.abs(amount));
  const amountCentavos = amount < 0 ? -absCents : absCents;
  return {
    transactionIdProvider: String(raw.transactionId),
    transactionDate: raw.date,
    description: raw.description || '',
    amountCentavos,
    type: amountCentavos > 0 ? 'credit' : 'debit',
    raw,
    accountRow,
  };
}

function resolveAccountForTx(accounts, tx) {
  const providerId = tx.accountIdProvider;
  if (providerId) {
    const found = accounts.find((a) => a.account_id_provider === providerId);
    if (found) return found;
  }
  return accounts[0] || null;
}

/**
 * Sincroniza transações do provider → openfinance_transactions + lançamentos JSONB.
 */
export async function syncConnection(client, {
  usuarioId,
  connectionId,
  contaId,
  planoId,
}) {
  const connection = await findConnection(client, connectionId, usuarioId);
  if (!connection) {
    const err = new Error('Conexão não encontrada.');
    err.status = 404;
    throw err;
  }

  if (connection.status !== 'active') {
    const err = new Error('Conexão inativa.');
    err.status = 422;
    throw err;
  }

  const accounts = await listAccountsByConnection(client, connectionId);
  if (!accounts.length) {
    const err = new Error('Conexão sem contas vinculadas.');
    err.status = 422;
    throw err;
  }

  const { rows: estadoRows } = await client.query(
    'SELECT dados FROM estados WHERE usuario_id = $1 FOR UPDATE',
    [usuarioId]
  );
  if (!estadoRows.length) {
    const err = new Error('Estado do usuário não encontrado.');
    err.status = 422;
    throw err;
  }

  let dados = estadoRows[0].dados;
  const syncCtx = prepareSyncContext(dados, contaId, planoId);
  const nextCodigo = syncCtx.bumpCodigo;

  const providerTxs = await fetchTransactionsViaProvider(connection, accounts);

  let imported = 0;
  let skipped = 0;
  const novosLancamentos = [];

  for (const raw of providerTxs) {
    const accountRow = resolveAccountForTx(accounts, raw);
    if (!accountRow) {
      skipped += 1;
      continue;
    }

    const mapped = mapProviderTx(raw, accountRow);
    const fingerprint = gerarFingerprintOpenFinance(
      usuarioId,
      connectionId,
      mapped.transactionIdProvider
    );

    const existing = await findTransactionByFingerprint(client, usuarioId, fingerprint);
    if (existing) {
      skipped += 1;
      continue;
    }

    const lanc = buildOpenFinanceLancamento(
      {
        amount_centavos: mapped.amountCentavos,
        transaction_date: mapped.transactionDate,
        description: mapped.description,
      },
      {
        conta: syncCtx.conta,
        contaId,
        planoId: planoId || '',
        codigo: nextCodigo(),
        connectionId,
        accountId: accountRow.id,
        transactionId: mapped.transactionIdProvider,
      }
    );

    await insertTransaction(client, {
      usuarioId,
      connectionId,
      accountId: accountRow.id,
      transactionIdProvider: mapped.transactionIdProvider,
      transactionDate: mapped.transactionDate,
      description: mapped.description,
      amountCentavos: mapped.amountCentavos,
      type: mapped.type,
      raw: mapped.raw,
      fingerprint,
      lancamentoId: lanc.id,
    });

    novosLancamentos.push(lanc);
    imported += 1;
  }

  if (novosLancamentos.length) {
    dados = appendOpenFinanceLancamentos(dados, novosLancamentos);
    await client.query(
      'UPDATE estados SET dados = $1, updated_at = NOW() WHERE usuario_id = $2',
      [JSON.stringify(dados), usuarioId]
    );
  }

  await touchConnection(client, connectionId);

  const status = imported > 0 ? 'success' : skipped > 0 ? 'skipped' : 'empty';
  const message = `importados=${imported}; ignorados=${skipped}; total_provider=${providerTxs.length}`;

  const log = await insertSyncLog(client, {
    usuarioId,
    connectionId,
    status,
    message,
  });

  return {
    imported,
    skipped,
    totalProvider: providerTxs.length,
    status,
    syncLog: log,
    lancamentosCriados: novosLancamentos.length,
  };
}
