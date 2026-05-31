/**
 * Conexões Bancárias — interesse "Avise-me" (Open Finance preparatório)
 * Sem integração real com provedores. Apenas persiste conexoes_interesse.
 */
import { Router } from "express";
import { query } from "../db.js";
import { authMiddleware, activeMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware, activeMiddleware);

const BANCOS_VALIDOS = new Set([
  "nubank", "itau", "bradesco", "bb", "caixa", "inter", "c6", "santander",
]);

// GET /api/conexoes/interesse
router.get("/interesse", async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT banco_slug, created_at FROM conexoes_interesse
       WHERE usuario_id = $1 ORDER BY created_at ASC`,
      [req.user.id]
    );
    res.json({ interesses: rows });
  } catch (err) {
    console.error("conexoes/interesse GET:", err.message);
    res.status(500).json({ error: "Erro ao carregar interesses." });
  }
});

// POST /api/conexoes/interesse  { banco_slug }
router.post("/interesse", async (req, res) => {
  const { banco_slug } = req.body || {};
  const slug = String(banco_slug || "").trim().toLowerCase();

  if (!slug || !BANCOS_VALIDOS.has(slug)) {
    return res.status(400).json({ error: "Banco inválido." });
  }

  try {
    const { rows } = await query(
      `INSERT INTO conexoes_interesse (usuario_id, banco_slug)
       VALUES ($1, $2)
       ON CONFLICT (usuario_id, banco_slug) DO UPDATE SET banco_slug = EXCLUDED.banco_slug
       RETURNING banco_slug, created_at`,
      [req.user.id, slug]
    );
    res.json({ ok: true, interesse: rows[0] });
  } catch (err) {
    console.error("conexoes/interesse POST:", err.message);
    res.status(500).json({ error: "Erro ao registrar interesse." });
  }
});

export { router as conexoesRouter };
