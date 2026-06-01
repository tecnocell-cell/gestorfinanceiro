/**
 * Importações — Etapa 4.6A/4.6B
 *
 * Rotas:
 *   POST /api/importacoes/ofx-preview   — parse + deduplicação, sem gravar
 *   POST /api/importacoes/ofx-confirmar — grava novas transações no JSONB
 *   GET  /api/importacoes               — histórico
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
} from '../utils/ofxImport.js';

const router = Router();
router.use(authMiddleware, activeMiddleware);

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

// ─── GET /api/importacoes ─────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, formato, banco_slug, nome_arquivo,
              total_linhas, importados, duplicatas, erros,
              lote_id, status, created_at
       FROM importacoes
       WHERE usuario_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json({ importacoes: rows });
  } catch (err) {
    console.error('importacoes GET:', err.message);
    res.status(500).json({ error: 'Erro ao carregar histórico.' });
  }
});

export { router as importacoesRouter };
