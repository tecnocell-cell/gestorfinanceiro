/**
 * Importações — Etapa 4.6A (preview apenas)
 *
 * Rotas:
 *   POST /api/importacoes/ofx-preview — parse + deduplicação, SEM gravar lançamentos
 *   GET  /api/importacoes             — histórico (vazio até Etapa 4.6B)
 *
 * Não altera tabela estados (JSONB), não grava fingerprints nesta etapa.
 */

import { Router } from 'express';
import { query } from '../db.js';
import { authMiddleware, activeMiddleware } from '../middleware/auth.js';
import { parseOfxFile } from '../utils/parseOfx.js';
import { gerarFingerprint } from '../utils/fingerprint.js';

const router = Router();
router.use(authMiddleware, activeMiddleware);

function classificarTransacoes(usuarioId, txs, existingSet) {
  const seenInFile = new Set();
  const transacoes = [];
  let novas = 0;
  let duplicadas = 0;

  for (const tx of txs) {
    const fp = gerarFingerprint(usuarioId, tx);
    let status = 'nova';

    if (existingSet.has(fp) || seenInFile.has(fp)) {
      status = 'duplicada';
      duplicadas += 1;
    } else {
      novas += 1;
      seenInFile.add(fp);
    }

    transacoes.push({
      data: tx.data,
      valor: tx.valor,
      tipo: tx.tipo,
      historico: tx.historico,
      fitid: tx.fitid || null,
      status,
    });
  }

  return { transacoes, novas, duplicadas };
}

// ─── POST /api/importacoes/ofx-preview ────────────────────────────────────────

router.post('/ofx-preview', async (req, res) => {
  const { contaId, planoId, fileName, fileContent } = req.body || {};
  const usuarioId = req.user.id;

  if (!fileContent || typeof fileContent !== 'string') {
    return res.status(400).json({ error: 'Campo fileContent obrigatório.' });
  }

  let parsed;
  try {
    parsed = parseOfxFile(fileContent);
  } catch (err) {
    console.error('importacoes/ofx-preview parse:', err.message);
    return res.status(422).json({
      error: 'Não foi possível interpretar o arquivo. Verifique se é um OFX ou QIF válido.',
    });
  }

  const { txs, bancoSlug } = parsed;

  if (!txs.length) {
    return res.status(422).json({ error: 'Nenhuma transação encontrada no arquivo.' });
  }

  const fingerprints = txs.map((tx) => gerarFingerprint(usuarioId, tx));
  const uniqueFps = [...new Set(fingerprints)];

  let existingSet = new Set();
  if (uniqueFps.length > 0) {
    const { rows: existing } = await query(
      `SELECT fingerprint FROM importacoes_fingerprints
       WHERE usuario_id = $1 AND fingerprint = ANY($2)`,
      [usuarioId, uniqueFps]
    );
    existingSet = new Set(existing.map((r) => r.fingerprint));
  }

  const { transacoes, novas, duplicadas } = classificarTransacoes(usuarioId, txs, existingSet);

  return res.json({
    banco: bancoSlug,
    total: txs.length,
    novas,
    duplicadas,
    transacoes,
  });
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
