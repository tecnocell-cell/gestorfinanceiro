/**
 * whatsappAdmin.js -- Rotas administrativas do modulo WhatsApp
 *
 * Acesso restrito a role = 'admin' (superadmin).
 *
 * Endpoints:
 *   GET    /api/whatsapp-admin/config               -- ler system_config (admin_instance, admin_phone)
 *   POST   /api/whatsapp-admin/config               -- gravar system_config
 *   GET    /api/whatsapp-admin/instance-status      -- status/QR da instancia global (cf-admin)
 *   POST   /api/whatsapp-admin/connect              -- conectar instancia global
 *   POST   /api/whatsapp-admin/disconnect           -- desconectar instancia global
 *
 * Numeros autorizados sao gerenciados pelo proprio tenant via /api/whatsapp/authorized.
 */

import crypto from "crypto";
import { Router } from "express";
import { query } from "../db.js";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";
import {
  createInstance,
  connectInstance,
  logoutInstance,
  deleteInstance,
} from "../whatsapp/evolutionProvider.js";

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

// ── Admin Instance (cf-admin) ─────────────────────────────────────────────────

async function upsertSysCfg(key, value) {
  await query(
    `INSERT INTO system_config (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, value]
  );
}

async function getAdminInstanceCfg() {
  const { rows } = await query(
    `SELECT key, value FROM system_config
      WHERE key IN (
        'whatsapp_admin_instance',
        'whatsapp_admin_status',
        'whatsapp_admin_qrcode',
        'whatsapp_admin_phone'
      )`
  );
  const cfg = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return {
    instanceName:  cfg.whatsapp_admin_instance || null,
    status:        cfg.whatsapp_admin_status   || "disconnected",
    qrcode:        cfg.whatsapp_admin_qrcode   || null,
    phoneNumber:   cfg.whatsapp_admin_phone    || null,
  };
}

function buildAdminWebhookUrl(instanceName, secret) {
  const base = (process.env.WEBHOOK_BASE_URL || "").replace(/\/$/, "");
  return `${base}/api/whatsapp/webhook/${instanceName}?secret=${secret}`;
}

// GET /api/whatsapp-admin/instance-status
whatsappAdminRouter.get("/instance-status", ...guard, async (_req, res) => {
  try {
    const cfg = await getAdminInstanceCfg();
    res.json(cfg);
  } catch (err) {
    console.error("[whatsapp-admin/instance-status]:", err.message);
    res.status(500).json({ error: "Erro ao buscar status da instancia." });
  }
});

// POST /api/whatsapp-admin/connect
whatsappAdminRouter.post("/connect", ...guard, async (req, res) => {
  try {
    const cfg = await getAdminInstanceCfg();
    const instanceName = cfg.instanceName;

    if (!instanceName) {
      return res.status(400).json({
        error: "whatsapp_admin_instance nao configurado. Configure o nome da instancia primeiro.",
      });
    }

    const webhookBase = (process.env.WEBHOOK_BASE_URL || "").trim();
    if (!webhookBase) {
      return res.status(503).json({
        error: "WEBHOOK_BASE_URL nao configurada no servidor.",
      });
    }

    if (cfg.status === "connected") {
      return res.status(409).json({
        error: "Instancia ja esta conectada. Desconecte antes de reconectar.",
        status: "connected",
      });
    }

    // Limpar instancia anterior
    try { await logoutInstance(instanceName); } catch { /* ignorar */ }
    try { await deleteInstance(instanceName); } catch { /* ignorar */ }

    const webhookSecret = crypto.randomBytes(32).toString("hex");
    const webhookUrl = buildAdminWebhookUrl(instanceName, webhookSecret);

    // Salvar secret e status antes de chamar a Evolution
    await upsertSysCfg("whatsapp_admin_webhook_secret", webhookSecret);
    await upsertSysCfg("whatsapp_admin_status", "connecting");
    await upsertSysCfg("whatsapp_admin_qrcode", "");

    // Criar instancia na Evolution
    try {
      await createInstance({ instanceName, webhookUrl, webhookSecret });
    } catch (err) {
      await upsertSysCfg("whatsapp_admin_status", "disconnected");
      console.error("[whatsapp-admin/connect] createInstance falhou:", err.message);
      return res.status(500).json({ error: "Erro ao criar instancia WhatsApp." });
    }

    // Solicitar QR (connectInstance)
    try {
      await connectInstance(instanceName);
    } catch (err) {
      console.warn("[whatsapp-admin/connect] connectInstance falhou (nao fatal):", err.message);
    }

    console.log(`[whatsapp-admin/connect] instancia criada: ${instanceName}`);
    res.status(201).json({
      ok: true,
      status: "connecting",
      message: "Instancia criada. Aguarde o QR code.",
    });
  } catch (err) {
    console.error("[whatsapp-admin/connect]:", err.message);
    res.status(500).json({ error: "Erro ao conectar instancia admin." });
  }
});

// POST /api/whatsapp-admin/disconnect
whatsappAdminRouter.post("/disconnect", ...guard, async (req, res) => {
  try {
    const cfg = await getAdminInstanceCfg();
    const instanceName = cfg.instanceName;

    if (!instanceName) {
      return res.status(400).json({ error: "whatsapp_admin_instance nao configurado." });
    }

    try { await logoutInstance(instanceName); } catch { /* ignorar */ }
    try { await deleteInstance(instanceName); } catch { /* ignorar */ }

    await upsertSysCfg("whatsapp_admin_status", "disconnected");
    await upsertSysCfg("whatsapp_admin_qrcode", "");

    console.log(`[whatsapp-admin/disconnect] instancia desconectada: ${instanceName}`);
    res.json({ ok: true });
  } catch (err) {
    console.error("[whatsapp-admin/disconnect]:", err.message);
    res.status(500).json({ error: "Erro ao desconectar instancia admin." });
  }
});
