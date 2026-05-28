/**
 * whatsappAdmin.js -- Rotas administrativas do modulo WhatsApp
 *
 * Acesso restrito a role = 'admin' (superadmin).
 *
 * Endpoints:
 *   GET    /api/whatsapp-admin/config               -- ler system_config (admin_instance, admin_phone)
 *   POST   /api/whatsapp-admin/config               -- gravar system_config
 *   GET    /api/whatsapp-admin/authorized            -- listar todos os numeros autorizados
 *   POST   /api/whatsapp-admin/authorized            -- adicionar numero
 *   PATCH  /api/whatsapp-admin/authorized/:id        -- atualizar (active, label)
 *   DELETE /api/whatsapp-admin/authorized/:id        -- remover
 */

import { Router } from "express";
import { query } from "../db.js";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";

export const whatsappAdminRouter = Router();

const guard = [authMiddleware, adminMiddleware];

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizePhone(raw) {
  if (!raw || typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  return /^\d{8,15}$/.test(digits) ? digits : null;
}

// ── Config (admin_instance / admin_phone) ─────────────────────────────────────

// GET /api/whatsapp-admin/config
whatsappAdminRouter.get("/config", ...guard, async (_req, res) => {
  try {
    const { rows } = await query(
      "SELECT key, value FROM system_config WHERE key IN ('whatsapp_admin_instance','whatsapp_admin_phone')"
    );
    const cfg = Object.fromEntries(rows.map(r => [r.key, r.value]));
    res.json({
      admin_instance: cfg.whatsapp_admin_instance || "",
      admin_phone:    cfg.whatsapp_admin_phone    || "",
    });
  } catch (err) {
    console.error("[whatsapp-admin/config GET]:", err.message);
    res.status(500).json({ error: "Erro ao buscar configuracao." });
  }
});

// POST /api/whatsapp-admin/config
// Body: { admin_instance?: string, admin_phone?: string }
whatsappAdminRouter.post("/config", ...guard, async (req, res) => {
  const { admin_instance, admin_phone } = req.body || {};
  const updates = [];

  if (admin_instance !== undefined) {
    updates.push({ key: "whatsapp_admin_instance", value: String(admin_instance).trim() });
  }
  if (admin_phone !== undefined) {
    const phone = normalizePhone(admin_phone);
    if (admin_phone && !phone) {
      return res.status(400).json({ error: "Formato de telefone invalido." });
    }
    updates.push({ key: "whatsapp_admin_phone", value: phone || "" });
  }

  if (!updates.length) {
    return res.status(400).json({ error: "Nenhum campo para atualizar." });
  }

  try {
    for (const { key, value } of updates) {
      await query(
        `INSERT INTO system_config (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, value]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[whatsapp-admin/config POST]:", err.message);
    res.status(500).json({ error: "Erro ao salvar configuracao." });
  }
});

// ── Numeros autorizados ───────────────────────────────────────────────────────

// GET /api/whatsapp-admin/authorized
// Retorna todos os numeros, com nome/email/tipo do usuario.
whatsappAdminRouter.get("/authorized", ...guard, async (_req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        wan.id,
        wan.usuario_id,
        wan.phone_number,
        wan.label,
        wan.active,
        wan.verified_at,
        wan.last_used_at,
        wan.created_at,
        wan.updated_at,
        u.nome,
        u.email,
        u.tipo_perfil,
        u.nome_perfil
      FROM whatsapp_authorized_numbers wan
      JOIN usuarios u ON u.id = wan.usuario_id
      ORDER BY wan.created_at DESC
    `);
    res.json({ authorized: rows });
  } catch (err) {
    console.error("[whatsapp-admin/authorized GET]:", err.message);
    res.status(500).json({ error: "Erro ao listar numeros autorizados." });
  }
});

// POST /api/whatsapp-admin/authorized
// Body: { usuario_id, phone_number, label? }
whatsappAdminRouter.post("/authorized", ...guard, async (req, res) => {
  const { usuario_id, phone_number, label = "" } = req.body || {};

  if (!usuario_id) return res.status(400).json({ error: "usuario_id obrigatorio." });
  const phone = normalizePhone(phone_number);
  if (!phone) return res.status(400).json({ error: "Formato de telefone invalido." });

  try {
    // Verificar se usuario existe
    const { rows: u } = await query("SELECT id, tipo_perfil FROM usuarios WHERE id = $1", [usuario_id]);
    if (!u.length) return res.status(404).json({ error: "Usuario nao encontrado." });

    const { rows } = await query(
      `INSERT INTO whatsapp_authorized_numbers (usuario_id, phone_number, label)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [usuario_id, phone, label.trim()]
    );
    res.status(201).json({ authorized: rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Este numero ja esta cadastrado para outro usuario." });
    }
    console.error("[whatsapp-admin/authorized POST]:", err.message);
    res.status(500).json({ error: "Erro ao cadastrar numero." });
  }
});

// PATCH /api/whatsapp-admin/authorized/:id
// Body: { active?, label? }
whatsappAdminRouter.patch("/authorized/:id", ...guard, async (req, res) => {
  const { id } = req.params;
  const { active, label } = req.body || {};

  const sets = [];
  const vals = [];
  let i = 1;

  if (active !== undefined) { sets.push(`active = $${i++}`); vals.push(!!active); }
  if (label  !== undefined) { sets.push(`label  = $${i++}`); vals.push(String(label).trim()); }

  if (!sets.length) return res.status(400).json({ error: "Nenhum campo para atualizar." });

  vals.push(id);
  try {
    const { rows } = await query(
      `UPDATE whatsapp_authorized_numbers SET ${sets.join(", ")}, updated_at = NOW()
       WHERE id = $${i} RETURNING *`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error: "Numero nao encontrado." });
    res.json({ authorized: rows[0] });
  } catch (err) {
    console.error("[whatsapp-admin/authorized PATCH]:", err.message);
    res.status(500).json({ error: "Erro ao atualizar numero." });
  }
});

// DELETE /api/whatsapp-admin/authorized/:id
whatsappAdminRouter.delete("/authorized/:id", ...guard, async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await query(
      "DELETE FROM whatsapp_authorized_numbers WHERE id = $1",
      [id]
    );
    if (!rowCount) return res.status(404).json({ error: "Numero nao encontrado." });
    res.json({ ok: true });
  } catch (err) {
    console.error("[whatsapp-admin/authorized DELETE]:", err.message);
    res.status(500).json({ error: "Erro ao remover numero." });
  }
});
