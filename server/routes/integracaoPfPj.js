/**
 * Integração PF/PJ — Etapa 5.0B (vínculo único, sem repasses)
 *
 * Rotas:
 *   GET    /api/integracao-pf-pj/vinculo
 *   POST   /api/integracao-pf-pj/vinculo
 *   DELETE /api/integracao-pf-pj/vinculo
 *   GET    /api/integracao-pf-pj/buscar-pf?email=
 *   POST   /api/integracao-pf-pj/aceitar
 *   POST   /api/integracao-pf-pj/recusar
 */

import { Router } from 'express';
import { query } from '../db.js';
import { authMiddleware, activeMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware, activeMiddleware);

const VINCULO_COLS = `id, usuario_pj_id, usuario_pf_id, email_pf, nome_pf,
  status, created_at, aceito_em, revogado_em`;

function mapVinculo(row, extra = {}) {
  if (!row) return null;
  return {
    id: row.id,
    usuarioPjId: row.usuario_pj_id,
    usuarioPfId: row.usuario_pf_id,
    emailPf: row.email_pf,
    nomePf: row.nome_pf,
    status: row.status,
    createdAt: row.created_at,
    aceitoEm: row.aceito_em,
    revogadoEm: row.revogado_em,
    ...extra,
  };
}

async function getTipoPerfil(usuarioId) {
  const { rows } = await query(
    'SELECT tipo_perfil, email, nome, nome_perfil FROM usuarios WHERE id = $1',
    [usuarioId]
  );
  return rows[0] || null;
}

async function requirePerfil(req, res, tipo) {
  const u = await getTipoPerfil(req.user.id);
  if (!u || u.tipo_perfil !== tipo) {
    res.status(403).json({ error: `Acesso restrito a contas ${tipo === 'juridica' ? 'PJ' : 'PF'}.` });
    return null;
  }
  return u;
}

async function findVinculoAtivoPj(usuarioPjId) {
  const { rows } = await query(
    `SELECT ${VINCULO_COLS}
     FROM integracao_pf_pj_vinculo
     WHERE usuario_pj_id = $1 AND status != 'revogado'
     ORDER BY created_at DESC
     LIMIT 1`,
    [usuarioPjId]
  );
  return rows[0] || null;
}

async function findPfByEmail(email) {
  const { rows } = await query(
    `SELECT id, email, nome, nome_perfil, tipo_perfil, ativo
     FROM usuarios
     WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  return rows[0] || null;
}

// ─── GET /vinculo ─────────────────────────────────────────────────────────────

router.get('/vinculo', async (req, res) => {
  try {
    const u = await getTipoPerfil(req.user.id);
    if (!u) return res.status(404).json({ error: 'Usuário não encontrado.' });

    if (u.tipo_perfil === 'juridica') {
      const row = await findVinculoAtivoPj(req.user.id);
      return res.json({ vinculo: mapVinculo(row) });
    }

    const { rows: pendentes } = await query(
      `SELECT v.id, v.usuario_pj_id, v.usuario_pf_id, v.email_pf, v.nome_pf,
              v.status, v.created_at, v.aceito_em, v.revogado_em,
              u.nome AS pj_nome, u.nome_perfil AS pj_nome_perfil
       FROM integracao_pf_pj_vinculo v
       JOIN usuarios u ON u.id = v.usuario_pj_id
       WHERE v.usuario_pf_id = $1 AND v.status = 'pendente'
       ORDER BY v.created_at DESC`,
      [req.user.id]
    );

    const { rows: ativos } = await query(
      `SELECT v.id, v.usuario_pj_id, v.usuario_pf_id, v.email_pf, v.nome_pf,
              v.status, v.created_at, v.aceito_em, v.revogado_em,
              u.nome AS pj_nome, u.nome_perfil AS pj_nome_perfil
       FROM integracao_pf_pj_vinculo v
       JOIN usuarios u ON u.id = v.usuario_pj_id
       WHERE v.usuario_pf_id = $1 AND v.status = 'ativo'
       ORDER BY v.created_at DESC`,
      [req.user.id]
    );

    return res.json({
      pendentes: pendentes.map((r) => mapVinculo(r, {
        nomePj: r.pj_nome_perfil || r.pj_nome,
      })),
      ativos: ativos.map((r) => mapVinculo(r, {
        nomePj: r.pj_nome_perfil || r.pj_nome,
      })),
    });
  } catch (err) {
    console.error('integracao-pf-pj GET /vinculo:', err.message);
    res.status(500).json({ error: 'Erro ao carregar vínculo.' });
  }
});

// ─── GET /buscar-pf ───────────────────────────────────────────────────────────

router.get('/buscar-pf', async (req, res) => {
  try {
    if (!(await requirePerfil(req, res, 'juridica'))) return;

    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Informe o e-mail da conta PF.' });

    const pf = await findPfByEmail(email);
    if (!pf || pf.tipo_perfil !== 'fisica' || !pf.ativo) {
      return res.status(404).json({ error: 'Nenhuma conta PF ativa encontrada com este e-mail.' });
    }

    if (pf.id === req.user.id) {
      return res.status(400).json({ error: 'Não é possível vincular a própria conta.' });
    }

    return res.json({
      id: pf.id,
      email: pf.email,
      nome: pf.nome_perfil || pf.nome,
    });
  } catch (err) {
    console.error('integracao-pf-pj GET /buscar-pf:', err.message);
    res.status(500).json({ error: 'Erro ao buscar conta PF.' });
  }
});

// ─── POST /vinculo ────────────────────────────────────────────────────────────

router.post('/vinculo', async (req, res) => {
  try {
    if (!(await requirePerfil(req, res, 'juridica'))) return;

    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Informe o e-mail da conta PF.' });

    const existente = await findVinculoAtivoPj(req.user.id);
    if (existente) {
      return res.status(409).json({
        error: 'Sua empresa já possui um vínculo pendente ou ativo. Revogue antes de vincular outra PF.',
        vinculo: mapVinculo(existente),
      });
    }

    const pf = await findPfByEmail(email);
    if (!pf || pf.tipo_perfil !== 'fisica' || !pf.ativo) {
      return res.status(404).json({ error: 'Nenhuma conta PF ativa encontrada com este e-mail.' });
    }

    if (pf.id === req.user.id) {
      return res.status(400).json({ error: 'Não é possível vincular a própria conta.' });
    }

    const { rows } = await query(
      `INSERT INTO integracao_pf_pj_vinculo (
         usuario_pj_id, usuario_pf_id, email_pf, nome_pf, status
       ) VALUES ($1, $2, $3, $4, 'pendente')
       RETURNING ${VINCULO_COLS}`,
      [req.user.id, pf.id, pf.email, pf.nome_perfil || pf.nome]
    );

    return res.status(201).json({ vinculo: mapVinculo(rows[0]) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Sua empresa já possui um vínculo ativo ou pendente.' });
    }
    console.error('integracao-pf-pj POST /vinculo:', err.message);
    res.status(500).json({ error: 'Erro ao criar vínculo.' });
  }
});

// ─── DELETE /vinculo ──────────────────────────────────────────────────────────

router.delete('/vinculo', async (req, res) => {
  try {
    if (!(await requirePerfil(req, res, 'juridica'))) return;

    const row = await findVinculoAtivoPj(req.user.id);
    if (!row) {
      return res.status(404).json({ error: 'Nenhum vínculo ativo ou pendente para revogar.' });
    }

    const { rows } = await query(
      `UPDATE integracao_pf_pj_vinculo
       SET status = 'revogado', revogado_em = NOW()
       WHERE id = $1 AND usuario_pj_id = $2 AND status != 'revogado'
       RETURNING ${VINCULO_COLS}`,
      [row.id, req.user.id]
    );

    return res.json({ ok: true, vinculo: mapVinculo(rows[0]) });
  } catch (err) {
    console.error('integracao-pf-pj DELETE /vinculo:', err.message);
    res.status(500).json({ error: 'Erro ao revogar vínculo.' });
  }
});

// ─── POST /aceitar ────────────────────────────────────────────────────────────

router.post('/aceitar', async (req, res) => {
  try {
    if (!(await requirePerfil(req, res, 'fisica'))) return;

    const vinculoId = req.body?.vinculoId || null;
    let row;

    if (vinculoId) {
      const { rows } = await query(
        `SELECT ${VINCULO_COLS}
         FROM integracao_pf_pj_vinculo
         WHERE id = $1 AND usuario_pf_id = $2 AND status = 'pendente'`,
        [vinculoId, req.user.id]
      );
      row = rows[0];
    } else {
      const { rows } = await query(
        `SELECT ${VINCULO_COLS}
         FROM integracao_pf_pj_vinculo
         WHERE usuario_pf_id = $1 AND status = 'pendente'
         ORDER BY created_at DESC
         LIMIT 1`,
        [req.user.id]
      );
      row = rows[0];
    }

    if (!row) {
      return res.status(404).json({ error: 'Nenhum convite pendente encontrado.' });
    }

    const { rows: updated } = await query(
      `UPDATE integracao_pf_pj_vinculo
       SET status = 'ativo', aceito_em = NOW()
       WHERE id = $1
       RETURNING ${VINCULO_COLS}`,
      [row.id]
    );

    return res.json({ ok: true, vinculo: mapVinculo(updated[0]) });
  } catch (err) {
    console.error('integracao-pf-pj POST /aceitar:', err.message);
    res.status(500).json({ error: 'Erro ao aceitar vínculo.' });
  }
});

// ─── POST /recusar ────────────────────────────────────────────────────────────

router.post('/recusar', async (req, res) => {
  try {
    if (!(await requirePerfil(req, res, 'fisica'))) return;

    const vinculoId = req.body?.vinculoId || null;
    let row;

    if (vinculoId) {
      const { rows } = await query(
        `SELECT ${VINCULO_COLS}
         FROM integracao_pf_pj_vinculo
         WHERE id = $1 AND usuario_pf_id = $2 AND status = 'pendente'`,
        [vinculoId, req.user.id]
      );
      row = rows[0];
    } else {
      const { rows } = await query(
        `SELECT ${VINCULO_COLS}
         FROM integracao_pf_pj_vinculo
         WHERE usuario_pf_id = $1 AND status = 'pendente'
         ORDER BY created_at DESC
         LIMIT 1`,
        [req.user.id]
      );
      row = rows[0];
    }

    if (!row) {
      return res.status(404).json({ error: 'Nenhum convite pendente encontrado.' });
    }

    const { rows: updated } = await query(
      `UPDATE integracao_pf_pj_vinculo
       SET status = 'revogado', revogado_em = NOW()
       WHERE id = $1
       RETURNING ${VINCULO_COLS}`,
      [row.id]
    );

    return res.json({ ok: true, vinculo: mapVinculo(updated[0]) });
  } catch (err) {
    console.error('integracao-pf-pj POST /recusar:', err.message);
    res.status(500).json({ error: 'Erro ao recusar vínculo.' });
  }
});

export { router as integracaoPfPjRouter };
