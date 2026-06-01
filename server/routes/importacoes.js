/**
 * Importações — Etapa 4.6A/4.6B/4.6C/4.7
 *
 * Rotas:
 *   POST /api/importacoes/ofx-preview      — parse + deduplicação, sem gravar
 *   POST /api/importacoes/ofx-confirmar    — grava novas transações no JSONB
 *   POST /api/importacoes/csv-preview      — preview CSV com mapeamento (Etapa 4.7)
 *   POST /api/importacoes/csv-confirmar    — confirma importação CSV
 *   POST /api/importacoes/xlsx-preview     — preview XLSX com mapeamento
 *   POST /api/importacoes/xlsx-confirmar   — confirma importação XLSX
 *   GET  /api/importacoes                  — histórico paginado
 *   GET  /api/importacoes/:id              — detalhe + lançamentos do lote
 *   POST /api/importacoes/:id/rollback     — desfaz importação por lote
 */

import { Router } from 'express';
import { pool, query } from '../db.js';
import { authMiddleware, activeMiddleware } from '../middleware/auth.js';
import { gerarFingerprint } from '../utils/fingerprint.js';
import {
  classificarTransacoes,
  loadExistingFingerprints,
  parseOfxForImport,
  confirmOfxImport,
  findLancamentosImportados,
  rollbackImport,
} from '../utils/ofxImport.js';
import {
  previewPlanilhaImport,
  confirmPlanilhaImport,
  parseCsvImport,
  parseXlsxImport,
} from '../utils/planilhaImport.js';

const router = Router();
router.use(authMiddleware, activeMiddleware);

const IMPORTACAO_COLS = `id, formato, banco_slug, nome_arquivo,
  total_linhas, importados, duplicatas, erros, lote_id, status, created_at`;

function parsePagination(queryParams) {
  const limit = Math.min(Math.max(parseInt(queryParams.limit, 10) || 50, 1), 100);
  const offset = Math.max(parseInt(queryParams.offset, 10) || 0, 0);
  return { limit, offset };
}

function handleRouteError(res, err, label) {
  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(`${label}:`, err.message);
  return res.status(500).json({ error: 'Erro ao processar importação.' });
}

async function handlePlanilhaPreview(req, res, { parseFn }) {
  const { contaId, planoId, fileName, fileContent, columnMap } = req.body || {};
  const usuarioId = req.user.id;

  try {
    const result = await previewPlanilhaImport(query, usuarioId, {
      fileContent,
      columnMap: columnMap || null,
      parseFn,
    });
    return res.json({
      ...result,
      meta: { contaId: contaId || null, planoId: planoId || null, fileName: fileName || null },
    });
  } catch (err) {
    return handleRouteError(res, err, 'importacoes/planilha-preview');
  }
}

async function handlePlanilhaConfirmar(req, res, { parseFn, formato, source }) {
  const { contaId, planoId, fileName, fileContent, columnMap } = req.body || {};
  const usuarioId = req.user.id;

  if (!columnMap?.data || !columnMap?.valor || !columnMap?.historico) {
    return res.status(400).json({ error: 'Mapeamento incompleto: data, valor e histórico são obrigatórios.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      'SELECT dados FROM estados WHERE usuario_id = $1 FOR UPDATE',
      [usuarioId]
    );

    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(422).json({ error: 'Estado do usuário não encontrado.' });
    }

    const result = await confirmPlanilhaImport(client, {
      usuarioId,
      contaId,
      planoId: planoId || null,
      fileName,
      fileContent,
      columnMap,
      dados: rows[0].dados,
      parseFn,
      formato,
      source,
    });

    await client.query('COMMIT');

    return res.json({
      importados: result.importados,
      duplicados: result.duplicados,
      erros: result.erros,
      importacaoId: result.importacaoId,
      loteId: result.loteId,
      status: result.status,
      total: result.total,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    return handleRouteError(res, err, `importacoes/${formato.toLowerCase()}-confirmar`);
  } finally {
    client.release();
  }
}

// ─── POST /api/importacoes/ofx-preview ────────────────────────────────────────

router.post('/ofx-preview', async (req, res) => {
  const { contaId, planoId, fileName, fileContent } = req.body || {};
  const usuarioId = req.user.id;

  try {
    const { txs, bancoSlug } = parseOfxForImport(fileContent);

    const fingerprints = txs.map((tx) => gerarFingerprint(usuarioId, tx));
    const existingSet = await loadExistingFingerprints(query, usuarioId, fingerprints);
    const { transacoes, novas, duplicadas } = classificarTransacoes(usuarioId, txs, existingSet);

    return res.json({
      banco: bancoSlug,
      total: txs.length,
      novas,
      duplicadas,
      transacoes: transacoes.map(({ fingerprint, _raw, ...t }) => t),
      meta: { contaId: contaId || null, planoId: planoId || null, fileName: fileName || null },
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('importacoes/ofx-preview:', err.message);
    return res.status(500).json({ error: 'Erro ao analisar o arquivo.' });
  }
});

// ─── POST /api/importacoes/ofx-confirmar ──────────────────────────────────────

router.post('/ofx-confirmar', async (req, res) => {
  const { contaId, planoId, fileName, fileContent } = req.body || {};
  const usuarioId = req.user.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      'SELECT dados FROM estados WHERE usuario_id = $1 FOR UPDATE',
      [usuarioId]
    );

    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(422).json({ error: 'Estado do usuário não encontrado.' });
    }

    const result = await confirmOfxImport(client, {
      usuarioId,
      contaId,
      planoId: planoId || null,
      fileName,
      fileContent,
      dados: rows[0].dados,
    });

    await client.query('COMMIT');

    return res.json({
      importados: result.importados,
      duplicados: result.duplicados,
      erros: result.erros,
      importacaoId: result.importacaoId,
      loteId: result.loteId,
      status: result.status,
      total: result.total,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('importacoes/ofx-confirmar:', err.message);
    return res.status(500).json({ error: 'Erro ao confirmar importação.' });
  } finally {
    client.release();
  }
});

// ─── POST /api/importacoes/csv-preview ────────────────────────────────────────

router.post('/csv-preview', (req, res) =>
  handlePlanilhaPreview(req, res, { parseFn: parseCsvImport })
);

// ─── POST /api/importacoes/csv-confirmar ──────────────────────────────────────

router.post('/csv-confirmar', (req, res) =>
  handlePlanilhaConfirmar(req, res, { parseFn: parseCsvImport, formato: 'CSV', source: 'csv' })
);

// ─── POST /api/importacoes/xlsx-preview ───────────────────────────────────────

router.post('/xlsx-preview', (req, res) =>
  handlePlanilhaPreview(req, res, { parseFn: parseXlsxImport })
);

// ─── POST /api/importacoes/xlsx-confirmar ─────────────────────────────────────

router.post('/xlsx-confirmar', (req, res) =>
  handlePlanilhaConfirmar(req, res, { parseFn: parseXlsxImport, formato: 'XLSX', source: 'xlsx' })
);

// ─── GET /api/importacoes ─────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const { limit, offset } = parsePagination(req.query);

    const [{ rows }, { rows: countRows }] = await Promise.all([
      query(
        `SELECT ${IMPORTACAO_COLS}
         FROM importacoes
         WHERE usuario_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [usuarioId, limit, offset]
      ),
      query(
        'SELECT COUNT(*)::int AS total FROM importacoes WHERE usuario_id = $1',
        [usuarioId]
      ),
    ]);

    res.json({
      importacoes: rows,
      total: countRows[0]?.total ?? 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error('importacoes GET:', err.message);
    res.status(500).json({ error: 'Erro ao carregar histórico.' });
  }
});

// ─── POST /api/importacoes/:id/rollback ───────────────────────────────────────

router.post('/:id/rollback', async (req, res) => {
  const usuarioId = req.user.id;
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await rollbackImport(client, {
      usuarioId,
      importacaoId: id,
    });

    await client.query('COMMIT');

    return res.json(result);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('importacoes POST/:id/rollback:', err.message);
    return res.status(500).json({ error: 'Erro ao desfazer importação.' });
  } finally {
    client.release();
  }
});

// ─── GET /api/importacoes/:id ─────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const { id } = req.params;

    const { rows: impRows } = await query(
      `SELECT ${IMPORTACAO_COLS}
       FROM importacoes
       WHERE id = $1 AND usuario_id = $2`,
      [id, usuarioId]
    );

    if (!impRows.length) {
      return res.status(404).json({ error: 'Importação não encontrada.' });
    }

    const importacao = impRows[0];
    let lancamentosImportados = [];

    if (importacao.lote_id) {
      const { rows: estadoRows } = await query(
        'SELECT dados FROM estados WHERE usuario_id = $1',
        [usuarioId]
      );
      if (estadoRows.length) {
        lancamentosImportados = findLancamentosImportados(
          estadoRows[0].dados,
          importacao.lote_id
        );
      }
    }

    res.json({ importacao, lancamentosImportados });
  } catch (err) {
    console.error('importacoes GET/:id:', err.message);
    res.status(500).json({ error: 'Erro ao carregar detalhes da importação.' });
  }
});

export { router as importacoesRouter };
