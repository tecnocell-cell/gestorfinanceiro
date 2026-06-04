/**
 * Suporte — chamados simples (Etapa 7.2)
 */
import { Router } from 'express';
import { authMiddleware, activeMiddleware, adminMiddleware } from '../middleware/auth.js';
import { query } from '../db.js';

const router = Router();

const CATEGORIAS = new Set(['financeiro', 'whatsapp', 'assinatura', 'equipe', 'outro']);
const STATUS = new Set(['aberto', 'em_andamento', 'resolvido']);

router.use(authMiddleware, activeMiddleware);

router.get('/tickets', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, categoria, assunto, descricao, status, anexo_nome, created_at, updated_at
       FROM support_tickets WHERE usuario_id = $1
       ORDER BY created_at DESC LIMIT 100`,
      [req.user.id]
    );
    res.json({ tickets: rows });
  } catch (err) {
    console.error('support/tickets GET:', err.message);
    res.status(500).json({ error: 'Erro ao listar chamados.' });
  }
});

router.post('/tickets', async (req, res) => {
  const { categoria = 'outro', assunto, descricao, anexo_nome, anexo_data } = req.body || {};
  if (!assunto?.trim() || !descricao?.trim()) {
    return res.status(400).json({ error: 'Assunto e descrição são obrigatórios.' });
  }
  const cat = CATEGORIAS.has(categoria) ? categoria : 'outro';
  try {
    const { rows } = await query(
      `INSERT INTO support_tickets (usuario_id, categoria, assunto, descricao, anexo_nome, anexo_data)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, categoria, assunto, descricao, status, anexo_nome, created_at, updated_at`,
      [
        req.user.id,
        cat,
        assunto.trim(),
        descricao.trim(),
        anexo_nome || null,
        anexo_data || null,
      ]
    );
    res.status(201).json({ ok: true, ticket: rows[0] });
  } catch (err) {
    console.error('support/tickets POST:', err.message);
    res.status(500).json({ error: 'Erro ao abrir chamado.' });
  }
});

router.patch('/tickets/:id', async (req, res) => {
  const { status } = req.body || {};
  if (!STATUS.has(status)) {
    return res.status(400).json({ error: 'Status inválido.' });
  }
  try {
    const { rows } = await query(
      `UPDATE support_tickets SET status = $1, updated_at = NOW()
       WHERE id = $2 AND usuario_id = $3
       RETURNING id, categoria, assunto, status, updated_at`,
      [status, req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Chamado não encontrado.' });
    res.json({ ok: true, ticket: rows[0] });
  } catch (err) {
    console.error('support/tickets PATCH:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar chamado.' });
  }
});

router.get('/admin/tickets-count', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS abertos
       FROM support_tickets
       WHERE status IN ('aberto', 'em_andamento')`
    );
    res.json({ abertos: rows[0]?.abertos || 0 });
  } catch (err) {
    console.error('support/admin count:', err.message);
    res.status(500).json({ error: 'Erro ao contar chamados.' });
  }
});

export function registerSupportRoutes(app) {
  app.use('/api/support', router);
}
