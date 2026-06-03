import { randomUUID } from 'crypto';

export async function findConnection(db, connectionId, usuarioId) {
  const { rows } = await db.query(
    `SELECT * FROM openfinance_connections
     WHERE id = $1 AND usuario_id = $2`,
    [connectionId, usuarioId]
  );
  return rows[0] || null;
}

export async function listConnections(db, usuarioId) {
  const { rows } = await db.query(
    `SELECT c.*,
       (SELECT COUNT(*)::int FROM openfinance_accounts a WHERE a.connection_id = c.id) AS accounts_count,
       (SELECT COUNT(*)::int FROM openfinance_transactions t WHERE t.connection_id = c.id) AS transactions_count
     FROM openfinance_connections c
     WHERE c.usuario_id = $1
     ORDER BY c.created_at DESC`,
    [usuarioId]
  );
  return rows;
}

export async function listAccountsByConnection(db, connectionId) {
  const { rows } = await db.query(
    `SELECT * FROM openfinance_accounts WHERE connection_id = $1 ORDER BY name`,
    [connectionId]
  );
  return rows;
}

export async function insertConnection(db, usuarioId, payload) {
  const id = randomUUID();
  const { rows } = await db.query(
    `INSERT INTO openfinance_connections
       (id, usuario_id, provider, institution_name, status, consent_id, provider_item_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      id,
      usuarioId,
      payload.provider,
      payload.institutionName,
      payload.status || 'active',
      payload.consentId || null,
      payload.providerItemId || null,
    ]
  );
  return rows[0];
}

export async function insertAccount(db, connectionId, acc) {
  const id = randomUUID();
  const { rows } = await db.query(
    `INSERT INTO openfinance_accounts
       (id, connection_id, account_id_provider, name, type, balance, currency)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      id,
      connectionId,
      acc.accountIdProvider,
      acc.name,
      acc.type || 'checking',
      acc.balance ?? 0,
      acc.currency || 'BRL',
    ]
  );
  return rows[0];
}

export async function deleteConnection(db, connectionId, usuarioId) {
  const { rowCount } = await db.query(
    `DELETE FROM openfinance_connections WHERE id = $1 AND usuario_id = $2`,
    [connectionId, usuarioId]
  );
  return rowCount > 0;
}

export async function touchConnection(db, connectionId) {
  await db.query(
    `UPDATE openfinance_connections SET updated_at = NOW() WHERE id = $1`,
    [connectionId]
  );
}

export async function findTransactionByFingerprint(db, usuarioId, fingerprint) {
  const { rows } = await db.query(
    `SELECT id, lancamento_id FROM openfinance_transactions
     WHERE usuario_id = $1 AND fingerprint = $2`,
    [usuarioId, fingerprint]
  );
  return rows[0] || null;
}

export async function insertTransaction(db, row) {
  const id = randomUUID();
  const { rows } = await db.query(
    `INSERT INTO openfinance_transactions
       (id, usuario_id, connection_id, account_id, transaction_id_provider,
        transaction_date, description, amount_centavos, type, raw, fingerprint, lancamento_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      id,
      row.usuarioId,
      row.connectionId,
      row.accountId,
      row.transactionIdProvider,
      row.transactionDate,
      row.description,
      row.amountCentavos,
      row.type,
      JSON.stringify(row.raw || {}),
      row.fingerprint,
      row.lancamentoId || null,
    ]
  );
  return rows[0];
}

export async function insertSyncLog(db, { usuarioId, connectionId, status, message }) {
  const { rows } = await db.query(
    `INSERT INTO openfinance_sync_logs (usuario_id, connection_id, status, message)
     VALUES ($1,$2,$3,$4)
     RETURNING *`,
    [usuarioId, connectionId, status, message]
  );
  return rows[0];
}

export async function listSyncLogs(db, usuarioId, connectionId, limit = 20) {
  const params = [usuarioId];
  let sql = `SELECT * FROM openfinance_sync_logs WHERE usuario_id = $1`;
  if (connectionId) {
    params.push(connectionId);
    sql += ` AND connection_id = $2`;
  }
  params.push(limit);
  sql += ` ORDER BY created_at DESC LIMIT $${params.length}`;
  const { rows } = await db.query(sql, params);
  return rows;
}

export async function listTransactions(db, usuarioId, { connectionId, limit = 50, offset = 0 } = {}) {
  const params = [usuarioId];
  let sql = `SELECT t.*, a.name AS account_name, c.institution_name
     FROM openfinance_transactions t
     JOIN openfinance_accounts a ON a.id = t.account_id
     JOIN openfinance_connections c ON c.id = t.connection_id
     WHERE t.usuario_id = $1`;
  if (connectionId) {
    params.push(connectionId);
    sql += ` AND t.connection_id = $2`;
  }
  params.push(limit, offset);
  sql += ` ORDER BY t.transaction_date DESC, t.created_at DESC
            LIMIT $${params.length - 1} OFFSET $${params.length}`;
  const { rows } = await db.query(sql, params);
  return rows;
}

export async function countTransactions(db, usuarioId, connectionId) {
  const params = [usuarioId];
  let sql = `SELECT COUNT(*)::int AS total FROM openfinance_transactions WHERE usuario_id = $1`;
  if (connectionId) {
    params.push(connectionId);
    sql += ` AND connection_id = $2`;
  }
  const { rows } = await db.query(sql, params);
  return rows[0]?.total ?? 0;
}
