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
 *   POST   /api/integracao-pf-pj/pro-labore/preview | /pro-labore
 *   POST   /api/integracao-pf-pj/lucros/preview | /lucros
 *   POST   /api/integracao-pf-pj/salario/preview | /salario
 *   POST   /api/integracao-pf-pj/transferencia/preview | /transferencia
 *   GET    /api/integracao-pf-pj/operacoes
 *   POST   /api/integracao-pf-pj/operacoes/:id/rollback
 *   GET    /api/integracao-pf-pj/agendamentos
 *   POST   /api/integracao-pf-pj/agendamentos
 *   PATCH  /api/integracao-pf-pj/agendamentos/:id
 *   DELETE /api/integracao-pf-pj/agendamentos/:id
 *   POST   /api/integracao-pf-pj/agendamentos/gerar-mes
 */

import { Router } from 'express';
import { query, pool } from '../db.js';
import { authMiddleware, activeMiddleware } from '../middleware/auth.js';
import {
  previewProLabore,
  confirmProLabore,
} from '../integracaoPfPj/proLaboreWriter.js';
import {
  previewOperacao,
  confirmOperacao,
  rollbackOperacao,
  mapOperacao,
} from '../integracaoPfPj/operacaoWriter.js';
import {
  AUDIT_ACAO,
  attachAuditoriaToOperacoes,
  insertIntegracaoAuditoria,
} from '../integracaoPfPj/auditoria.js';
import {
  AGENDAMENTO_STATUS,
  assertTipoAgendamento,
  centavosFromAgendamentoBody,
  gerarRepassesDoMes,
  mapAgendamento,
  parseDiaMes,
  parseMesReferencia,
} from '../integracaoPfPj/agendamentos.js';
import { isPessoaFisica, isPessoaJuridica, normalizeTipoPerfil } from '../profileTipo.js';
import { reaisFromCentavos, resolveValorCentavos } from '../utils/money.js';

/** Centavos inteiros a partir do body (valorCentavos preferido; nunca float*100). */
function centavosFromIntegracaoBody(body = {}) {
  return resolveValorCentavos({
    valorCentavos: body.valorCentavos ?? body.valor_centavos,
    valor_centavos: body.valor_centavos ?? body.valorCentavos,
    valor: body.valor,
  });
}

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
  const perfil = normalizeTipoPerfil(u?.tipo_perfil);
  const esperado = normalizeTipoPerfil(tipo);
  if (!u || perfil !== esperado) {
    res.status(403).json({ error: `Acesso restrito a contas ${esperado === 'juridica' ? 'PJ' : 'PF'}.` });
    return null;
  }
  return { ...u, tipo_perfil: perfil };
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

async function findVinculoAtivoConfirmado(usuarioPjId, dbQuery = query) {
  const { rows } = await dbQuery(
    `SELECT ${VINCULO_COLS}
     FROM integracao_pf_pj_vinculo
     WHERE usuario_pj_id = $1 AND status = 'ativo'
     LIMIT 1`,
    [usuarioPjId]
  );
  return rows[0] || null;
}

async function loadEstadosForPreview(usuarioPjId, usuarioPfId) {
  const [{ rows: pjRows }, { rows: pfRows }, uPj] = await Promise.all([
    query('SELECT dados FROM estados WHERE usuario_id = $1', [usuarioPjId]),
    query('SELECT dados FROM estados WHERE usuario_id = $1', [usuarioPfId]),
    getTipoPerfil(usuarioPjId),
  ]);
  if (!pjRows.length || !pfRows.length) {
    const err = new Error('Estado PJ ou PF não encontrado.');
    err.status = 422;
    throw err;
  }
  return { dadosPj: pjRows[0].dados, dadosPf: pfRows[0].dados, nomePj: uPj?.nome_perfil || uPj?.nome };
}

const MSG_VINCULO_PRO_LABORE = 'Vínculo PF ativo necessário para lançar pró-labore.';
const MSG_VINCULO_LUCROS = 'Vínculo PF ativo necessário para distribuir lucros.';
const MSG_VINCULO_SALARIO = 'Vínculo PF ativo necessário para lançar salário.';
const MSG_VINCULO_TRANSFERENCIA = 'Vínculo PF ativo necessário para transferência PJ→PF.';

function registerOperacaoPjPfRoutes(router, {
  path,
  tipoOperacao,
  msgVinculo,
  erroConfirmar,
}) {
  router.post(`/${path}/preview`, async (req, res) => {
    try {
      if (!(await requirePerfil(req, res, 'juridica'))) return;

      const vinculo = await findVinculoAtivoConfirmado(req.user.id);
      if (!vinculo) {
        return res.status(422).json({ error: msgVinculo });
      }

      const { data, observacao } = req.body || {};
      const cents = centavosFromIntegracaoBody(req.body);
      const { dadosPj, dadosPf, nomePj } = await loadEstadosForPreview(
        req.user.id,
        vinculo.usuario_pf_id
      );

      const preview = previewOperacao(tipoOperacao, {
        dadosPj,
        dadosPf,
        vinculo,
        nomePj,
        centavosInput: cents,
        valor: reaisFromCentavos(cents),
        data,
        observacao,
      });

      await insertIntegracaoAuditoria(null, {
        operacaoId: preview.operacaoId,
        vinculoId: vinculo.id,
        usuarioPjId: req.user.id,
        usuarioPfId: vinculo.usuario_pf_id,
        acao: AUDIT_ACAO.PREVIEW,
        tipoOperacao,
        valorCentavos: cents,
        payload: { data, observacao: observacao || '', path },
      });

      return res.json(preview);
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      console.error(`integracao-pf-pj POST /${path}/preview:`, err.message);
      res.status(500).json({ error: 'Erro ao gerar preview.' });
    }
  });

  router.post(`/${path}`, async (req, res) => {
    if (!(await requirePerfil(req, res, 'juridica'))) return;

    const client = await pool.connect();
    try {
      const { data, observacao } = req.body || {};
      const cents = centavosFromIntegracaoBody(req.body);

      await client.query('BEGIN');

      const { rows: vincRows } = await client.query(
        `SELECT ${VINCULO_COLS}
         FROM integracao_pf_pj_vinculo
         WHERE usuario_pj_id = $1 AND status = 'ativo'
         FOR UPDATE`,
        [req.user.id]
      );

      if (!vincRows.length) {
        await client.query('ROLLBACK');
        return res.status(422).json({ error: msgVinculo });
      }

      const vinculo = vincRows[0];
      const estados = await lockEstadosOrdenados(client, req.user.id, vinculo.usuario_pf_id);
      const uPj = await getTipoPerfil(req.user.id);
      const uPf = await getTipoPerfil(vinculo.usuario_pf_id);

      const result = await confirmOperacao(client, tipoOperacao, {
        usuarioPjId: req.user.id,
        vinculo,
        nomePj: uPj?.nome_perfil || uPj?.nome,
        dadosPj: estados[req.user.id],
        dadosPf: estados[vinculo.usuario_pf_id],
        pjProfile: uPj,
        pfProfile: uPf,
        centavosInput: cents,
        valor: reaisFromCentavos(cents),
        data,
        observacao,
      });

      await client.query('COMMIT');

      return res.status(201).json(result);
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.status) return res.status(err.status).json({ error: err.message });
      console.error(`integracao-pf-pj POST /${path}:`, err.message);
      res.status(500).json({ error: erroConfirmar });
    } finally {
      client.release();
    }
  });
}

async function lockEstadosOrdenados(client, usuarioA, usuarioB) {
  const sorted = [usuarioA, usuarioB].sort();
  const out = {};
  for (const uid of sorted) {
    const { rows } = await client.query(
      'SELECT usuario_id, dados FROM estados WHERE usuario_id = $1 FOR UPDATE',
      [uid]
    );
    if (!rows.length) {
      const err = new Error(`Estado não encontrado para usuário ${uid}.`);
      err.status = 422;
      throw err;
    }
    out[uid] = rows[0].dados;
  }
  return out;
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

    if (isPessoaJuridica(u.tipo_perfil)) {
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
    if (!pf || !isPessoaFisica(pf.tipo_perfil) || !pf.ativo) {
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
    if (!pf || !isPessoaFisica(pf.tipo_perfil) || !pf.ativo) {
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

// ─── POST /pro-labore/preview ─────────────────────────────────────────────────

router.post('/pro-labore/preview', async (req, res) => {
  try {
    if (!(await requirePerfil(req, res, 'juridica'))) return;

    const vinculo = await findVinculoAtivoConfirmado(req.user.id);
    if (!vinculo) {
      return res.status(422).json({ error: MSG_VINCULO_PRO_LABORE });
    }

    const { data, observacao } = req.body || {};
    const cents = centavosFromIntegracaoBody(req.body);
    const { dadosPj, dadosPf, nomePj } = await loadEstadosForPreview(
      req.user.id,
      vinculo.usuario_pf_id
    );

    const preview = previewProLabore({
      dadosPj,
      dadosPf,
      vinculo,
      nomePj,
      centavosInput: cents,
      valor: reaisFromCentavos(cents),
      data,
      observacao,
    });

    await insertIntegracaoAuditoria(null, {
      operacaoId: preview.operacaoId,
      vinculoId: vinculo.id,
      usuarioPjId: req.user.id,
      usuarioPfId: vinculo.usuario_pf_id,
      acao: AUDIT_ACAO.PREVIEW,
      tipoOperacao: 'pro_labore',
      valorCentavos: cents,
      payload: { data, observacao: observacao || '', path: 'pro-labore' },
    });

    return res.json(preview);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('integracao-pf-pj POST /pro-labore/preview:', err.message);
    res.status(500).json({ error: 'Erro ao gerar preview.' });
  }
});

// ─── POST /pro-labore ─────────────────────────────────────────────────────────

router.post('/pro-labore', async (req, res) => {
  if (!(await requirePerfil(req, res, 'juridica'))) return;

  const client = await pool.connect();
  try {
    const { data, observacao } = req.body || {};
    const cents = centavosFromIntegracaoBody(req.body);

    await client.query('BEGIN');

    const { rows: vincRows } = await client.query(
      `SELECT ${VINCULO_COLS}
       FROM integracao_pf_pj_vinculo
       WHERE usuario_pj_id = $1 AND status = 'ativo'
       FOR UPDATE`,
      [req.user.id]
    );

    if (!vincRows.length) {
      await client.query('ROLLBACK');
      return res.status(422).json({ error: MSG_VINCULO_PRO_LABORE });
    }

    const vinculo = vincRows[0];
    const estados = await lockEstadosOrdenados(client, req.user.id, vinculo.usuario_pf_id);
    const uPj = await getTipoPerfil(req.user.id);
    const uPf = await getTipoPerfil(vinculo.usuario_pf_id);

    const result = await confirmProLabore(client, {
      usuarioPjId: req.user.id,
      vinculo,
      nomePj: uPj?.nome_perfil || uPj?.nome,
      dadosPj: estados[req.user.id],
      dadosPf: estados[vinculo.usuario_pf_id],
      pjProfile: uPj,
      pfProfile: uPf,
      centavosInput: cents,
      valor: reaisFromCentavos(cents),
      data,
      observacao,
    });

    await client.query('COMMIT');

    return res.status(201).json(result);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('integracao-pf-pj POST /pro-labore:', err.message);
    res.status(500).json({ error: 'Erro ao registrar pró-labore.' });
  } finally {
    client.release();
  }
});

// ─── POST /lucros/preview ─────────────────────────────────────────────────────

router.post('/lucros/preview', async (req, res) => {
  try {
    if (!(await requirePerfil(req, res, 'juridica'))) return;

    const vinculo = await findVinculoAtivoConfirmado(req.user.id);
    if (!vinculo) {
      return res.status(422).json({ error: MSG_VINCULO_LUCROS });
    }

    const { data, observacao } = req.body || {};
    const cents = centavosFromIntegracaoBody(req.body);
    const { dadosPj, dadosPf, nomePj } = await loadEstadosForPreview(
      req.user.id,
      vinculo.usuario_pf_id
    );

    const preview = previewOperacao('distribuicao_lucros', {
      dadosPj,
      dadosPf,
      vinculo,
      nomePj,
      centavosInput: cents,
      valor: reaisFromCentavos(cents),
      data,
      observacao,
    });

    await insertIntegracaoAuditoria(null, {
      operacaoId: preview.operacaoId,
      vinculoId: vinculo.id,
      usuarioPjId: req.user.id,
      usuarioPfId: vinculo.usuario_pf_id,
      acao: AUDIT_ACAO.PREVIEW,
      tipoOperacao: 'distribuicao_lucros',
      valorCentavos: cents,
      payload: { data, observacao: observacao || '', path: 'lucros' },
    });

    return res.json(preview);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('integracao-pf-pj POST /lucros/preview:', err.message);
    res.status(500).json({ error: 'Erro ao gerar preview.' });
  }
});

// ─── POST /lucros ─────────────────────────────────────────────────────────────

router.post('/lucros', async (req, res) => {
  if (!(await requirePerfil(req, res, 'juridica'))) return;

  const client = await pool.connect();
  try {
    const { data, observacao } = req.body || {};
    const cents = centavosFromIntegracaoBody(req.body);

    await client.query('BEGIN');

    const { rows: vincRows } = await client.query(
      `SELECT ${VINCULO_COLS}
       FROM integracao_pf_pj_vinculo
       WHERE usuario_pj_id = $1 AND status = 'ativo'
       FOR UPDATE`,
      [req.user.id]
    );

    if (!vincRows.length) {
      await client.query('ROLLBACK');
      return res.status(422).json({ error: MSG_VINCULO_LUCROS });
    }

    const vinculo = vincRows[0];
    const estados = await lockEstadosOrdenados(client, req.user.id, vinculo.usuario_pf_id);
    const uPj = await getTipoPerfil(req.user.id);
    const uPf = await getTipoPerfil(vinculo.usuario_pf_id);

    const result = await confirmOperacao(client, 'distribuicao_lucros', {
      usuarioPjId: req.user.id,
      vinculo,
      nomePj: uPj?.nome_perfil || uPj?.nome,
      dadosPj: estados[req.user.id],
      dadosPf: estados[vinculo.usuario_pf_id],
      pjProfile: uPj,
      pfProfile: uPf,
      centavosInput: cents,
      valor: reaisFromCentavos(cents),
      data,
      observacao,
    });

    await client.query('COMMIT');

    return res.status(201).json(result);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('integracao-pf-pj POST /lucros:', err.message);
    res.status(500).json({ error: 'Erro ao registrar distribuição de lucros.' });
  } finally {
    client.release();
  }
});

registerOperacaoPjPfRoutes(router, {
  path: 'salario',
  tipoOperacao: 'salario',
  msgVinculo: MSG_VINCULO_SALARIO,
  erroConfirmar: 'Erro ao registrar salário.',
});

registerOperacaoPjPfRoutes(router, {
  path: 'transferencia',
  tipoOperacao: 'transferencia_pj_pf',
  msgVinculo: MSG_VINCULO_TRANSFERENCIA,
  erroConfirmar: 'Erro ao registrar transferência PJ→PF.',
});

// ─── GET /operacoes ───────────────────────────────────────────────────────────

router.get('/operacoes', async (req, res) => {
  try {
    if (!(await requirePerfil(req, res, 'juridica'))) return;

    const { rows } = await query(
      `SELECT o.id, o.vinculo_id, o.tipo_operacao, o.valor_centavos, o.data, o.historico,
              o.lancamento_pj_id, o.lancamento_pf_id, o.status, o.created_at
       FROM integracao_pf_pj_operacoes o
       JOIN integracao_pf_pj_vinculo v ON v.id = o.vinculo_id
       WHERE v.usuario_pj_id = $1
       ORDER BY o.created_at DESC
       LIMIT 100`,
      [req.user.id]
    );

    const operacoes = await attachAuditoriaToOperacoes(rows.map(mapOperacao));
    return res.json({
      operacoes,
      total: operacoes.length,
    });
  } catch (err) {
    console.error('integracao-pf-pj GET /operacoes:', err.message);
    res.status(500).json({ error: 'Erro ao listar operações.' });
  }
});

// ─── Agendamentos (Etapa 5.7 — geração manual) ────────────────────────────────

async function findAgendamentoOwned(clientOrQuery, id, usuarioPjId) {
  const q = clientOrQuery?.query ? clientOrQuery : { query };
  const { rows } = await q.query(
    `SELECT a.*
     FROM integracao_pf_pj_agendamentos a
     JOIN integracao_pf_pj_vinculo v ON v.id = a.vinculo_id
     WHERE a.id = $1 AND v.usuario_pj_id = $2`,
    [id, usuarioPjId]
  );
  return rows[0] || null;
}

router.get('/agendamentos', async (req, res) => {
  try {
    if (!(await requirePerfil(req, res, 'juridica'))) return;

    const { rows } = await query(
      `SELECT a.*
       FROM integracao_pf_pj_agendamentos a
       JOIN integracao_pf_pj_vinculo v ON v.id = a.vinculo_id
       WHERE v.usuario_pj_id = $1
       ORDER BY a.status ASC, a.dia_mes ASC, a.created_at DESC`,
      [req.user.id]
    );

    return res.json({
      agendamentos: rows.map(mapAgendamento),
      total: rows.length,
    });
  } catch (err) {
    console.error('integracao-pf-pj GET /agendamentos:', err.message);
    res.status(500).json({ error: 'Erro ao listar agendamentos.' });
  }
});

router.post('/agendamentos', async (req, res) => {
  try {
    if (!(await requirePerfil(req, res, 'juridica'))) return;

    const vinculo = await findVinculoAtivoConfirmado(req.user.id);
    if (!vinculo) {
      return res.status(422).json({ error: 'Vínculo PF ativo necessário para cadastrar agendamentos.' });
    }

    const body = req.body || {};
    const tipoOperacao = body.tipoOperacao || body.tipo_operacao;
    assertTipoAgendamento(tipoOperacao);
    const cents = centavosFromAgendamentoBody(body);
    const diaMes = parseDiaMes(body.diaMes ?? body.dia_mes);
    const observacao = String(body.observacao || '').trim();

    const { rows } = await query(
      `INSERT INTO integracao_pf_pj_agendamentos (
         vinculo_id, usuario_pj_id, tipo_operacao, valor_centavos, dia_mes, observacao, status
       ) VALUES ($1,$2,$3,$4,$5,$6,'ativa')
       RETURNING *`,
      [vinculo.id, req.user.id, tipoOperacao, cents, diaMes, observacao]
    );

    return res.status(201).json({ agendamento: mapAgendamento(rows[0]) });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('integracao-pf-pj POST /agendamentos:', err.message);
    res.status(500).json({ error: 'Erro ao criar agendamento.' });
  }
});

router.post('/agendamentos/gerar-mes', async (req, res) => {
  if (!(await requirePerfil(req, res, 'juridica'))) return;

  const client = await pool.connect();
  try {
    const mesRef = parseMesReferencia(req.body?.mes);
    const forcar = Boolean(req.body?.forcar);

    await client.query('BEGIN');

    const { rows: vincRows } = await client.query(
      `SELECT ${VINCULO_COLS}
       FROM integracao_pf_pj_vinculo
       WHERE usuario_pj_id = $1 AND status = 'ativo'
       FOR UPDATE`,
      [req.user.id]
    );

    if (!vincRows.length) {
      await client.query('ROLLBACK');
      return res.status(422).json({ error: 'Vínculo PF ativo necessário para gerar repasses.' });
    }

    const vinculo = vincRows[0];
    const { rows: agRows } = await client.query(
      `SELECT a.*
       FROM integracao_pf_pj_agendamentos a
       WHERE a.vinculo_id = $1
       ORDER BY a.dia_mes ASC, a.created_at ASC`,
      [vinculo.id]
    );

    if (!agRows.length) {
      await client.query('ROLLBACK');
      return res.status(422).json({ error: 'Nenhum agendamento cadastrado.' });
    }

    const uPj = await getTipoPerfil(req.user.id);
    const uPf = await getTipoPerfil(vinculo.usuario_pf_id);

    const result = await gerarRepassesDoMes(client, {
      usuarioPjId: req.user.id,
      vinculo,
      nomePj: uPj?.nome_perfil || uPj?.nome,
      pjProfile: uPj,
      pfProfile: uPf,
      mesRef,
      agendamentos: agRows,
      forcar,
    });

    await client.query('COMMIT');

    return res.json({
      ...result,
      totalGerados: result.gerados.length,
      totalIgnorados: result.ignorados.length,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('integracao-pf-pj POST /agendamentos/gerar-mes:', err.message);
    res.status(500).json({ error: 'Erro ao gerar repasses do mês.' });
  } finally {
    client.release();
  }
});

router.patch('/agendamentos/:id', async (req, res) => {
  try {
    if (!(await requirePerfil(req, res, 'juridica'))) return;

    const existing = await findAgendamentoOwned(query, req.params.id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: 'Agendamento não encontrado.' });
    }

    const body = req.body || {};
    const sets = [];
    const params = [];
    let i = 1;

    if (body.tipoOperacao != null || body.tipo_operacao != null) {
      const tipo = body.tipoOperacao || body.tipo_operacao;
      assertTipoAgendamento(tipo);
      sets.push(`tipo_operacao = $${i++}`);
      params.push(tipo);
    }
    if (
      body.valorCentavos != null ||
      body.valor_centavos != null ||
      body.valor != null
    ) {
      const cents = centavosFromAgendamentoBody(body);
      sets.push(`valor_centavos = $${i++}`);
      params.push(cents);
    }
    if (body.diaMes != null || body.dia_mes != null) {
      sets.push(`dia_mes = $${i++}`);
      params.push(parseDiaMes(body.diaMes ?? body.dia_mes));
    }
    if (body.observacao != null) {
      sets.push(`observacao = $${i++}`);
      params.push(String(body.observacao || '').trim());
    }
    if (body.status != null) {
      const st = String(body.status);
      if (!AGENDAMENTO_STATUS.includes(st)) {
        return res.status(400).json({ error: 'Status inválido.' });
      }
      sets.push(`status = $${i++}`);
      params.push(st);
    }

    if (!sets.length) {
      return res.json({ agendamento: mapAgendamento(existing) });
    }

    params.push(req.params.id);
    const { rows } = await query(
      `UPDATE integracao_pf_pj_agendamentos SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${i} RETURNING *`,
      params
    );

    return res.json({ agendamento: mapAgendamento(rows[0]) });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('integracao-pf-pj PATCH /agendamentos/:id:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar agendamento.' });
  }
});

router.delete('/agendamentos/:id', async (req, res) => {
  try {
    if (!(await requirePerfil(req, res, 'juridica'))) return;

    const { rows } = await query(
      `DELETE FROM integracao_pf_pj_agendamentos a
       USING integracao_pf_pj_vinculo v
       WHERE a.vinculo_id = v.id AND a.id = $1 AND v.usuario_pj_id = $2
       RETURNING a.id`,
      [req.params.id, req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Agendamento não encontrado.' });
    }

    return res.json({ ok: true, id: rows[0].id });
  } catch (err) {
    console.error('integracao-pf-pj DELETE /agendamentos/:id:', err.message);
    res.status(500).json({ error: 'Erro ao excluir agendamento.' });
  }
});

// ─── POST /operacoes/:id/rollback ─────────────────────────────────────────────

router.post('/operacoes/:id/rollback', async (req, res) => {
  if (!(await requirePerfil(req, res, 'juridica'))) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await rollbackOperacao(client, {
      usuarioPjId: req.user.id,
      operacaoId: req.params.id,
    });

    await client.query('COMMIT');

    return res.json(result);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('integracao-pf-pj POST /operacoes/:id/rollback:', err.message);
    res.status(500).json({ error: 'Erro ao desfazer operação.' });
  } finally {
    client.release();
  }
});

export { router as integracaoPfPjRouter };
