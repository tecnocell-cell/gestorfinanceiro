/**
 * whatsappAdmin.js -- Rotas administrativas do modulo WhatsApp
 *
 * Acesso restrito a role = 'admin' (superadmin).
 *
 * Endpoints:
 *   GET    /api/whatsapp-admin/config               -- ler system_config (admin_instance, admin_phone)
 *   POST   /api/whatsapp-admin/config               -- gravar system_config
 *
 * Numeros autorizados sao gerenciados pelo proprio tenant via /api/whatsapp/authorized.
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

