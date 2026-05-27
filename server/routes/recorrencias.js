/**
 * Rotas de Recorrências — despesas e receitas fixas por tenant
 * ✅ Isolado: cada usuário só acessa as próprias recorrências
 * ✅ Sem alterar nenhuma rota existente
 */
import { Router } from "express";
import { query } from "../db.js";
import { authMiddleware, activeMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware, activeMiddleware);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normaliza qualquer formato de data para YYYY-MM-DD.
 * Retorna null se o valor for inválido — NUNCA lança exceção.
 *
 * Casos protegidos:
 *   null / undefined / ""         → null
 *   Date inválido (Invalid Date)  → null
 *   String sem formato ISO        → null  (antes retornava a string raw, causando crash)
 */
function toDateStr(val) {
  if (val === null || val === undefined || val === "") return null;
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return null;
    return val.toISOString().slice(0, 10);
  }
  const s = String(val).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null; // null (não a string raw) se formato não for ISO
}

/**
 * Calcula a próxima data de vencimento com base na periodicidade.
 * Retorna null se dataAtual for inválida — NUNCA lança exceção.
 *
 * Pontos de guarda:
 *   1. toDateStr retorna null           → retorna null antes de criar Date
 *   2. new Date() produz Invalid Date   → detectado com Number.isNaN(d.getTime())
 *   3. aritmética de data inválida      → verificado novamente antes de toISOString()
 */
function calcProximaData(periodicidade, dataAtual) {
  const key = toDateStr(dataAtual);
  if (!key) return null; // guard 1: entrada inválida

  const d = new Date(key + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null; // guard 2: parse inválido

  if (periodicidade === "mensal")       d.setMonth(d.getMonth() + 1);
  else if (periodicidade === "semanal") d.setDate(d.getDate() + 7);
  else if (periodicidade === "anual")   d.setFullYear(d.getFullYear() + 1);

  if (Number.isNaN(d.getTime())) return null; // guard 3: após aritmética
  return d.toISOString().slice(0, 10);
}

const CAMPOS_VALIDOS_TIPO          = ["Receita", "Despesa"];
const CAMPOS_VALIDOS_PERIODICIDADE = ["mensal", "semanal", "anual"];
const CAMPOS_VALIDOS_STATUS        = ["ativa", "pausada", "encerrada"];

// ─── GET /api/recorrencias ────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM recorrencias
       WHERE usuario_id = $1
       ORDER BY
         CASE status WHEN 'ativa' THEN 0 WHEN 'pausada' THEN 1 ELSE 2 END,
         proxima_data ASC,
         created_at DESC`,
      [req.user.id]
    );
    res.json({ recorrencias: rows });
  } catch (err) {
    console.error("recorrencias GET:", err.message);
    res.status(500).json({ error: "Erro ao listar recorrências." });
  }
});

// ─── POST /api/recorrencias ───────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const {
    tipo, descricao, valor, periodicidade,
    proxima_data, plano_id, conta_id, empresa_id, observacao,
  } = req.body || {};

  if (!tipo || !descricao || valor === undefined || !periodicidade || !proxima_data) {
    return res.status(400).json({
      error: "Campos obrigatórios: tipo, descricao, valor, periodicidade, proxima_data.",
    });
  }
  if (!CAMPOS_VALIDOS_TIPO.includes(tipo)) {
    return res.status(400).json({ error: "Tipo deve ser 'Receita' ou 'Despesa'." });
  }
  if (!CAMPOS_VALIDOS_PERIODICIDADE.includes(periodicidade)) {
    return res.status(400).json({ error: "Periodicidade deve ser 'mensal', 'semanal' ou 'anual'." });
  }
  const valorNum = parseFloat(valor);
  if (isNaN(valorNum) || valorNum <= 0) {
    return res.status(400).json({ error: "Valor deve ser um número positivo." });
  }

  try {
    const { rows } = await query(
      `INSERT INTO recorrencias
         (usuario_id, tipo, descricao, valor, periodicidade, proxima_data,
          plano_id, conta_id, empresa_id, observacao)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        req.user.id, tipo, descricao.trim(), valorNum,
        periodicidade, proxima_data,
        plano_id   || null,
        conta_id   || null,
        empresa_id || null,
        observacao || null,
      ]
    );
    res.status(201).json({ recorrencia: rows[0] });
  } catch (err) {
    console.error("recorrencias POST:", err.message);
    res.status(500).json({ error: "Erro ao criar recorrência." });
  }
});

// ─── PATCH /api/recorrencias/:id ─────────────────────────────────────────────
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const {
    tipo, descricao, valor, periodicidade,
    proxima_data, plano_id, conta_id, empresa_id, observacao, status,
  } = req.body || {};

  // Validações opcionais (só valida se o campo foi enviado)
  if (tipo && !CAMPOS_VALIDOS_TIPO.includes(tipo)) {
    return res.status(400).json({ error: "Tipo inválido." });
  }
  if (periodicidade && !CAMPOS_VALIDOS_PERIODICIDADE.includes(periodicidade)) {
    return res.status(400).json({ error: "Periodicidade inválida." });
  }
  if (status && !CAMPOS_VALIDOS_STATUS.includes(status)) {
    return res.status(400).json({ error: "Status inválido." });
  }

  try {
    // Verifica que pertence ao usuário
    const own = await query(
      "SELECT id FROM recorrencias WHERE id = $1 AND usuario_id = $2",
      [id, req.user.id]
    );
    if (!own.rows.length) {
      return res.status(404).json({ error: "Recorrência não encontrada." });
    }

    const valorNum = valor !== undefined ? parseFloat(valor) : null;

    const { rows } = await query(
      `UPDATE recorrencias SET
         tipo          = COALESCE($1,  tipo),
         descricao     = COALESCE($2,  descricao),
         valor         = COALESCE($3,  valor),
         periodicidade = COALESCE($4,  periodicidade),
         proxima_data  = COALESCE($5,  proxima_data),
         plano_id      = COALESCE($6,  plano_id),
         conta_id      = COALESCE($7,  conta_id),
         empresa_id    = COALESCE($8,  empresa_id),
         observacao    = COALESCE($9,  observacao),
         status        = COALESCE($10, status)
       WHERE id = $11 AND usuario_id = $12
       RETURNING *`,
      [
        tipo   || null,
        descricao ? descricao.trim() : null,
        valorNum,
        periodicidade || null,
        proxima_data  || null,
        plano_id   !== undefined ? (plano_id   || null) : null,
        conta_id   !== undefined ? (conta_id   || null) : null,
        empresa_id !== undefined ? (empresa_id || null) : null,
        observacao !== undefined ? (observacao || null) : null,
        status || null,
        id,
        req.user.id,
      ]
    );
    res.json({ recorrencia: rows[0] });
  } catch (err) {
    console.error("recorrencias PATCH:", err.message);
    res.status(500).json({ error: "Erro ao atualizar recorrência." });
  }
});

// ─── DELETE /api/recorrencias/:id ────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await query(
      "DELETE FROM recorrencias WHERE id = $1 AND usuario_id = $2 RETURNING id",
      [id, req.user.id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: "Recorrência não encontrada." });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("recorrencias DELETE:", err.message);
    res.status(500).json({ error: "Erro ao excluir recorrência." });
  }
});

// ─── POST /api/recorrencias/:id/gerar ────────────────────────────────────────
/**
 * Avança a proxima_data da recorrência para o próximo ciclo.
 * O lançamento real é criado pelo FRONTEND via saveLancamento/lancCrud,
 * que usa o caminho testado e seguro do JSONB.
 */
router.post("/:id/gerar", async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await query(
      "SELECT * FROM recorrencias WHERE id = $1 AND usuario_id = $2",
      [id, req.user.id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: "Recorrência não encontrada." });
    }

    const rec = rows[0];
    if (rec.status !== "ativa") {
      return res.status(400).json({
        error: `Recorrência está ${rec.status}. Ative-a antes de gerar um lançamento.`,
      });
    }

    // ── Validação defensiva de data ─────────────────────────────────────────
    // calcProximaData retorna null se proxima_data for inválida.
    // Logar os detalhes da recorrência problemática e retornar 422
    // sem derrubar o servidor e sem remover nada do banco.
    const novaData = calcProximaData(rec.periodicidade, rec.proxima_data);

    if (!novaData) {
      console.error(
        "[recorrencias/gerar] DATA INVÁLIDA — recorrência ignorada sem quebrar o backend.\n" +
        "  id=" + rec.id + "\n" +
        "  descricao=" + JSON.stringify(rec.descricao) + "\n" +
        "  proxima_data=" + JSON.stringify(rec.proxima_data) + "\n" +
        "  periodicidade=" + JSON.stringify(rec.periodicidade)
      );
      return res.status(422).json({
        error: "Esta recorrência possui uma data inválida e não pode ser processada. " +
               "Edite a recorrência e defina uma data válida para continuar.",
        recorrencia: {
          id: rec.id,
          descricao: rec.descricao,
          proxima_data: rec.proxima_data,
          periodicidade: rec.periodicidade,
        },
      });
    }

    await query(
      "UPDATE recorrencias SET proxima_data = $1 WHERE id = $2",
      [novaData, id]
    );

    res.json({ ok: true, proxima_data: novaData });
  } catch (err) {
    console.error("recorrencias/gerar:", err.message);
    res.status(500).json({ error: "Erro ao gerar lançamento." });
  }
});

export { router as recorrenciasRouter };
