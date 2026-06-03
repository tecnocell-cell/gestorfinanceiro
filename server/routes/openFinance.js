/**
 * Open Finance MVP — Etapa 6.1
 *
 * GET    /api/open-finance/status
 * GET    /api/open-finance/connections
 * POST   /api/open-finance/connections/mock
 * POST   /api/open-finance/connect/init
 * POST   /api/open-finance/connections/pluggy
 * POST   /api/open-finance/connections/:id/sync
 * DELETE /api/open-finance/connections/:id
 * GET    /api/open-finance/transactions
 * GET    /api/open-finance/sync-logs
 */

import { Router } from 'express';
import { pool } from '../db.js';
import { authMiddleware, activeMiddleware } from '../middleware/auth.js';
import {
  getModuleStatus,
  createMockConnectionForUser,
  getConnectionsWithAccounts,
  initPluggyConnectForUser,
  completePluggyConnectionForUser,
} from '../openFinance/connectionService.js';
import { syncConnection } from '../openFinance/syncService.js';
import {
  findConnection,
  deleteConnection,
  listSyncLogs,
  listTransactions,
  countTransactions,
} from '../openFinance/repository.js';
import { reaisFromCentavos } from '../utils/money.js';
import { assertOpenFinanceReal, handlePlanAccessError } from '../billing/accessControl.js';

const router = Router();
router.use(authMiddleware, activeMiddleware);

async function guardOpenFinanceReal(req, res, next) {
  try {
    await assertOpenFinanceReal(req.user.id);
    next();
  } catch (err) {
    const handled = handlePlanAccessError(res, err);
    if (handled) return handled;
    next(err);
  }
}

function parsePagination(query) {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 50, 1), 100);
  const offset = Math.max(parseInt(query.offset, 10) || 0, 0);
  return { limit, offset };
}

router.get('/status', async (_req, res) => {
  try {
    const status = await getModuleStatus();
    return res.json(status);
  } catch (err) {
    console.error('open-finance/status:', err.message);
    return res.status(500).json({ error: 'Erro ao consultar status do Open Finance.' });
  }
});

router.get('/connections', async (req, res) => {
  try {
    const connections = await getConnectionsWithAccounts(pool, req.user.id);
    return res.json({ connections });
  } catch (err) {
    console.error('open-finance/connections:', err.message);
    return res.status(500).json({ error: 'Erro ao listar conexões.' });
  }
});

router.post('/connect/init', guardOpenFinanceReal, async (req, res) => {
  const usuarioId = req.user.id;
  try {
    const result = await initPluggyConnectForUser(usuarioId);
    return res.json({
      provider: result.provider,
      connectToken: result.connectToken,
      expiresInMinutes: result.expiresInMinutes,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        error: err.message,
        code: err.code || undefined,
        credentialsMissing: err.status === 503,
      });
    }
    console.error('open-finance/connect/init:', err.message);
    return res.status(500).json({ error: 'Erro ao iniciar conexão Open Finance.' });
  }
});

router.post('/connections/pluggy', guardOpenFinanceReal, async (req, res) => {
  const usuarioId = req.user.id;
  const { itemId } = req.body || {};

  try {
    const result = await completePluggyConnectionForUser(pool, usuarioId, { itemId });
    return res.status(201).json({
      connection: {
        id: result.connection.id,
        provider: result.connection.provider,
        institutionName: result.connection.institution_name,
        status: result.connection.status,
        providerItemId: result.connection.provider_item_id,
        createdAt: result.connection.created_at,
      },
      accounts: result.accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        balance: Number(a.balance),
      })),
      provider: result.provider,
      pluggyItemStatus: result.pluggyItemStatus,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('open-finance/connections/pluggy:', err.message);
    return res.status(500).json({ error: 'Erro ao registrar conexão Pluggy.' });
  }
});

router.post('/connections/mock', async (req, res) => {
  const usuarioId = req.user.id;
  try {
    const result = await createMockConnectionForUser(pool, usuarioId, req.body || {});
    return res.status(201).json({
      connection: {
        id: result.connection.id,
        provider: result.connection.provider,
        institutionName: result.connection.institution_name,
        status: result.connection.status,
        createdAt: result.connection.created_at,
      },
      accounts: result.accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        balance: Number(a.balance),
      })),
      provider: result.provider,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('open-finance/connections/mock:', err.message);
    return res.status(500).json({ error: 'Erro ao criar conexão demo.' });
  }
});

router.post('/connections/:id/sync', async (req, res) => {
  const usuarioId = req.user.id;
  const { id } = req.params;
  const { contaId, planoId } = req.body || {};

  if (!contaId) {
    return res.status(400).json({ error: 'Campo contaId é obrigatório.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await syncConnection(client, {
      usuarioId,
      connectionId: id,
      contaId,
      planoId: planoId || null,
    });
    await client.query('COMMIT');
    return res.json(result);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('open-finance/sync:', err.message);
    return res.status(500).json({ error: 'Erro ao sincronizar transações.' });
  } finally {
    client.release();
  }
});

router.delete('/connections/:id', async (req, res) => {
  const usuarioId = req.user.id;
  const { id } = req.params;
  try {
    const conn = await findConnection(pool, id, usuarioId);
    if (!conn) return res.status(404).json({ error: 'Conexão não encontrada.' });
    await deleteConnection(pool, id, usuarioId);
    return res.json({ ok: true });
  } catch (err) {
    console.error('open-finance/delete:', err.message);
    return res.status(500).json({ error: 'Erro ao remover conexão.' });
  }
});

router.get('/transactions', async (req, res) => {
  const usuarioId = req.user.id;
  const { limit, offset } = parsePagination(req.query);
  const connectionId = req.query.connectionId || null;

  try {
    const [transactions, total] = await Promise.all([
      listTransactions(pool, usuarioId, { connectionId, limit, offset }),
      countTransactions(pool, usuarioId, connectionId),
    ]);

    return res.json({
      transactions: transactions.map((t) => ({
        id: t.id,
        connectionId: t.connection_id,
        accountId: t.account_id,
        accountName: t.account_name,
        institutionName: t.institution_name,
        transactionIdProvider: t.transaction_id_provider,
        date: t.transaction_date,
        description: t.description,
        amountCentavos: Number(t.amount_centavos),
        amount: reaisFromCentavos(Number(t.amount_centavos)),
        type: t.type,
        lancamentoId: t.lancamento_id,
        createdAt: t.created_at,
      })),
      total,
      limit,
      offset,
    });
  } catch (err) {
    console.error('open-finance/transactions:', err.message);
    return res.status(500).json({ error: 'Erro ao listar transações.' });
  }
});

router.get('/sync-logs', async (req, res) => {
  const usuarioId = req.user.id;
  const connectionId = req.query.connectionId || null;
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

  try {
    const logs = await listSyncLogs(pool, usuarioId, connectionId, limit);
    return res.json({
      logs: logs.map((l) => ({
        id: l.id,
        connectionId: l.connection_id,
        status: l.status,
        message: l.message,
        createdAt: l.created_at,
      })),
    });
  } catch (err) {
    console.error('open-finance/sync-logs:', err.message);
    return res.status(500).json({ error: 'Erro ao listar histórico de sincronização.' });
  }
});

export default router;
