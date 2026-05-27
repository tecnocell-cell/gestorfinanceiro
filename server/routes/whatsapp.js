/**
 * Rotas WhatsApp Financeiro — Fase 2: conexão QR + webhook
 *
 * Endpoints protegidos (JWT obrigatório):
 *   POST   /api/whatsapp/connect      — conecta / reconecta instância
 *   GET    /api/whatsapp/status       — retorna status da sessão do tenant
 *   GET    /api/whatsapp/qrcode       — retorna QR code PNG base64
 *   POST   /api/whatsapp/disconnect   — desconecta e remove instância
 *
 * Endpoint público (validado por ?secret=):
 *   POST   /api/whatsapp/webhook/:instanceName — recebe eventos da Evolution API
 *
 * Segurança:
 *   - EVOLUTION_API_KEY nunca exposto no frontend
 *   - webhook_secret nunca retornado nas respostas ao frontend
 *   - Cada tenant tem isolamento completo (usuario_id em toda query)
 */
import { Router } from "express";
import crypto from "crypto";
import { query } from "../db.js";
import { authMiddleware, activeMiddleware } from "../middleware/auth.js";
import {
  createInstance,
  logoutInstance,
  deleteInstance,
} from "../whatsapp/evolutionProvider.js";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Gera o nome de instância padronizado para o tenant. */
function buildInstanceName(usuarioId) {
  return `cf-${usuarioId}`;
}

/** Gera a URL do webhook incluindo o segredo como query param. */
function buildWebhookUrl(instanceName, webhookSecret) {
  const base = (process.env.WEBHOOK_BASE_URL || "").replace(/\/$/, "");
  return `${base}/api/whatsapp/webhook/${instanceName}?secret=${webhookSecret}`;
}

// ─── Middleware de autenticação (rotas protegidas) ────────────────────────────
const auth = [authMiddleware, activeMiddleware];

// ─── POST /api/whatsapp/connect ───────────────────────────────────────────────
/**
 * Conecta o tenant ao WhatsApp.
 * - Se já existe sessão com status 'connected': retorna 409.
 * - Se existe sessão pendente/desconectada: limpa e recria.
 * - Cria nova instância na Evolution API e aguarda QR via webhook.
 */
router.post("/connect", ...auth, async (req, res) => {
  const usuarioId = req.user.id;
  const instanceName = buildInstanceName(usuarioId);

  try {
    // Verifica sessão existente
    const { rows: existing } = await query(
      "SELECT id, status FROM whatsapp_sessions WHERE usuario_id = $1",
      [usuarioId]
    );

    if (existing.length) {
      const sess = existing[0];

      if (sess.status === "connected") {
        return res.status(409).json({
          error: "WhatsApp já está conectado. Desconecte antes de reconectar.",
          status: "connected",
        });
      }

      // Limpa instância antiga da Evolution (ignora 404)
      await logoutInstance(instanceName);
      await deleteInstance(instanceName);

      // Remove registro antigo do banco
      await query(
        "DELETE FROM whatsapp_sessions WHERE usuario_id = $1",
        [usuarioId]
      );
    }

    // Gera segredo único para este tenant
    const webhookSecret = crypto.randomBytes(32).toString("hex");
    const webhookUrl = buildWebhookUrl(instanceName, webhookSecret);

    // Cria instância na Evolution API
    await createInstance({ instanceName, webhookUrl });

    // Persiste sessão como 'connecting' (QR chegará via webhook)
    await query(
      `INSERT INTO whatsapp_sessions
         (usuario_id, instance_name, status, webhook_secret)
       VALUES ($1, $2, 'connecting', $3)`,
      [usuarioId, instanceName, webhookSecret]
    );

    res.status(201).json({
      ok: true,
      status: "connecting",
      message: "Instância criada. Aguarde o QR code.",
    });
  } catch (err) {
    console.error("whatsapp/connect:", err.message);
    res.status(500).json({ error: "Erro ao conectar WhatsApp." });
  }
});

// ─── GET /api/whatsapp/status ─────────────────────────────────────────────────
/**
 * Retorna o status da sessão do tenant.
 * Campos retornados: status, phone_number.
 * Campos NUNCA retornados: webhook_secret, qrcode_base64.
 */
router.get("/status", ...auth, async (req, res) => {
  try {
    const { rows } = await query(
      "SELECT status, phone_number FROM whatsapp_sessions WHERE usuario_id = $1",
      [req.user.id]
    );

    if (!rows.length) {
      return res.json({ status: "disconnected", phone_number: null });
    }

    res.json({
      status: rows[0].status,
      phone_number: rows[0].phone_number || null,
    });
  } catch (err) {
    console.error("whatsapp/status:", err.message);
    res.status(500).json({ error: "Erro ao verificar status." });
  }
});

// ─── GET /api/whatsapp/qrcode ─────────────────────────────────────────────────
/**
 * Retorna o QR code PNG base64 armazenado no banco.
 * Disponível apenas enquanto status = 'connecting'.
 * Após conexão, qrcode_base64 é apagado do banco.
 */
router.get("/qrcode", ...auth, async (req, res) => {
  try {
    const { rows } = await query(
      "SELECT status, qrcode_base64 FROM whatsapp_sessions WHERE usuario_id = $1",
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Nenhuma sessão encontrada." });
    }

    const sess = rows[0];

    if (sess.status === "connected") {
      return res.status(409).json({ error: "WhatsApp já está conectado." });
    }

    if (!sess.qrcode_base64) {
      return res.status(202).json({
        message: "QR code ainda não disponível. Aguarde alguns segundos.",
      });
    }

    res.json({ qrcode: sess.qrcode_base64 });
  } catch (err) {
    console.error("whatsapp/qrcode:", err.message);
    res.status(500).json({ error: "Erro ao obter QR code." });
  }
});

// ─── POST /api/whatsapp/disconnect ────────────────────────────────────────────
/**
 * Desconecta o tenant do WhatsApp.
 * - Faz logout na Evolution API
 * - Deleta a instância da Evolution API
 * - Remove o registro do banco
 */
router.post("/disconnect", ...auth, async (req, res) => {
  const usuarioId = req.user.id;
  const instanceName = buildInstanceName(usuarioId);

  try {
    // Verifica se existe sessão
    const { rows } = await query(
      "SELECT id FROM whatsapp_sessions WHERE usuario_id = $1",
      [usuarioId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Nenhuma sessão WhatsApp encontrada." });
    }

    // Desloga e deleta da Evolution (ignora 404)
    await logoutInstance(instanceName);
    await deleteInstance(instanceName);

    // Remove do banco
    await query(
      "DELETE FROM whatsapp_sessions WHERE usuario_id = $1",
      [usuarioId]
    );

    // Limpa pendentes associados ao tenant
    await query(
      "DELETE FROM whatsapp_pending WHERE usuario_id = $1",
      [usuarioId]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("whatsapp/disconnect:", err.message);
    res.status(500).json({ error: "Erro ao desconectar WhatsApp." });
  }
});

// ─── POST /api/whatsapp/webhook/:instanceName ─────────────────────────────────
/**
 * Recebe eventos da Evolution API.
 * Autenticação: ?secret= na URL (configurado no createInstance).
 *
 * Eventos tratados:
 *   QRCODE_UPDATED    — armazena qrcode_base64 no banco
 *   CONNECTION_UPDATE — atualiza status (connecting → connected | disconnected)
 *
 * Eventos ignorados silenciosamente: qualquer outro event type.
 */
router.post("/webhook/:instanceName", async (req, res) => {
  const { instanceName } = req.params;
  const secret = req.query.secret;

  // Responde 200 imediatamente para a Evolution não retentar
  res.json({ ok: true });

  // Valida segredo após responder (para não bloquear a resposta)
  try {
    const { rows } = await query(
      "SELECT usuario_id, webhook_secret FROM whatsapp_sessions WHERE instance_name = $1",
      [instanceName]
    );

    if (!rows.length) {
      console.warn(`[whatsapp/webhook] Instância desconhecida: ${instanceName}`);
      return;
    }

    const sess = rows[0];

    // Validação do segredo (timing-safe)
    const expected = Buffer.from(sess.webhook_secret);
    const received = Buffer.from(secret || "");
    if (
      expected.length !== received.length ||
      !crypto.timingSafeEqual(expected, received)
    ) {
      console.warn(`[whatsapp/webhook] Segredo inválido para instância: ${instanceName}`);
      return;
    }

    const event = req.body?.event;
    const data  = req.body?.data;

    if (!event) return;

    // ── QRCODE_UPDATED ───────────────────────────────────────────────────────
    if (event === "QRCODE_UPDATED") {
      // Evolution envia base64: true → campo base64 contém "data:image/png;base64,..."
      const qrBase64 = data?.qrcode?.base64 || data?.base64 || null;

      if (!qrBase64) {
        console.warn(`[whatsapp/webhook] QRCODE_UPDATED sem base64 para ${instanceName}`);
        return;
      }

      await query(
        `UPDATE whatsapp_sessions
         SET qrcode_base64 = $1, status = 'connecting', updated_at = NOW()
         WHERE instance_name = $2`,
        [qrBase64, instanceName]
      );

      console.log(`[whatsapp/webhook] QR atualizado: ${instanceName}`);
      return;
    }

    // ── CONNECTION_UPDATE ────────────────────────────────────────────────────
    if (event === "CONNECTION_UPDATE") {
      const state = data?.state; // "open" | "connecting" | "close"

      if (state === "open") {
        // Conectado com sucesso — limpa QR e atualiza phone
        const phoneNumber = data?.instance?.owner || data?.phoneNumber || null;

        await query(
          `UPDATE whatsapp_sessions
           SET status = 'connected',
               phone_number = COALESCE($1, phone_number),
               qrcode_base64 = NULL,
               updated_at = NOW()
           WHERE instance_name = $2`,
          [phoneNumber, instanceName]
        );

        console.log(`[whatsapp/webhook] Conectado: ${instanceName} phone=${phoneNumber}`);

      } else if (state === "close") {
        // Desconectado remotamente (celular deslogou, sessão expirou, etc.)
        await query(
          `UPDATE whatsapp_sessions
           SET status = 'disconnected',
               qrcode_base64 = NULL,
               updated_at = NOW()
           WHERE instance_name = $2`,
          [instanceName]
        );

        console.log(`[whatsapp/webhook] Desconectado: ${instanceName}`);

      } else if (state === "connecting") {
        await query(
          `UPDATE whatsapp_sessions
           SET status = 'connecting', updated_at = NOW()
           WHERE instance_name = $1`,
          [instanceName]
        );
      }

      return;
    }

    // Qualquer outro evento é ignorado silenciosamente
  } catch (err) {
    console.error(`[whatsapp/webhook] Erro ao processar evento (${instanceName}):`, err.message);
  }
});

export { router as whatsappRouter };
