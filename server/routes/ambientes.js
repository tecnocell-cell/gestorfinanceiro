import { Router } from 'express';
import { authMiddleware, activeMiddleware } from '../middleware/auth.js';
import { subscriptionGuard } from '../middleware/subscriptionGuard.js';
import { attachEmpresaContext } from '../auth/permissions.js';
import {
  listAmbientes,
  createAmbiente,
  getAmbientePrincipal,
  initializeAmbienteInState,
} from '../ambientes/ambientesService.js';
import { query } from '../db.js';

const router = Router();
const guard = [authMiddleware, activeMiddleware, subscriptionGuard, attachEmpresaContext];

// GET /api/ambientes — lista ambientes do usuário
router.get('/', guard, async (req, res) => {
  try {
    const ambientes = await listAmbientes(req.stateOwnerId);
    res.json({ ambientes });
  } catch (err) {
    console.error('GET /api/ambientes:', err.message);
    res.status(500).json({ error: 'Erro ao listar ambientes.' });
  }
});

// POST /api/ambientes — cria novo ambiente e inicializa dados vazios
router.post('/', guard, async (req, res) => {
  const { nome, tipo = 'empresa', icone, cor, cnpj, segmento } = req.body || {};
  try {
    const ambiente = await createAmbiente(req.stateOwnerId, { nome, tipo, icone, cor });
    await initializeAmbienteInState(req.stateOwnerId, ambiente.id, tipo, nome, { cnpj, segmento });
    res.status(201).json({ ambiente });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Já existe um ambiente com este nome.' });
    }
    console.error('POST /api/ambientes:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/ambientes/:id — atualiza nome/ícone/cor de um ambiente
router.put('/:id', guard, async (req, res) => {
  const { id } = req.params;
  const { nome, icone, cor } = req.body || {};
  try {
    const { rows } = await query(
      `UPDATE ambientes_financeiros
       SET nome = COALESCE($1, nome),
           icone = COALESCE($2, icone),
           cor = COALESCE($3, cor),
           updated_at = NOW()
       WHERE id = $4 AND usuario_id = $5 AND ativo = true
       RETURNING id, nome, tipo, icone, cor, ordem`,
      [nome?.trim() || null, icone || null, cor || null, id, req.stateOwnerId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Ambiente não encontrado.' });
    res.json({ ambiente: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Já existe um ambiente com este nome.' });
    }
    console.error('PUT /api/ambientes/:id:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar ambiente.' });
  }
});

// POST /api/ambientes/:id/selecionar — define ambiente ativo no estado do usuário
router.post('/:id/selecionar', guard, async (req, res) => {
  const { id } = req.params;
  try {
    // Valida que o ambiente pertence ao usuário
    const { rows } = await query(
      `SELECT id FROM ambientes_financeiros
       WHERE id = $1 AND usuario_id = $2 AND ativo = true`,
      [id, req.stateOwnerId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Ambiente não encontrado.' });

    // Persiste ambienteAtualId no estado JSONB
    await query(
      `UPDATE estados
       SET dados = jsonb_set(COALESCE(dados, '{}'), '{ambienteAtualId}', $1::jsonb, true),
           updated_at = NOW()
       WHERE usuario_id = $2`,
      [JSON.stringify(id), req.stateOwnerId]
    );

    res.json({ ok: true, ambienteAtualId: id });
  } catch (err) {
    console.error('POST /api/ambientes/:id/selecionar:', err.message);
    res.status(500).json({ error: 'Erro ao selecionar ambiente.' });
  }
});

export { router as ambientesRouter };
