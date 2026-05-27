import { Router } from "express";
import crypto from "crypto";
import QRCode from "qrcode";
import { query } from "../db.js";
import { authMiddleware, activeMiddleware } from "../middleware/auth.js";
import {
  createInstance,
  connectInstance,
  logoutInstance,
  deleteInstance,
} from "../whatsapp/evolutionProvider.js";

const router = Router();

function buildInstanceName(usuarioId) {
  return `cf-${usuarioId}`;
}

function buildWebhookUrl(instanceName, webhookSecret) {
  const base = (process.env.WEBHOOK_BASE_URL || "").replace(/\/$/, "");
  return `${base}/api/whatsapp/webhook/${instanceName}?secret=${webhookSecret}`;
}

/**
 * Extrai QR code de uma resposta da Evolution API.
 * Tenta multiplos campos em ordem de preferencia.
 * Retorna { type: 'png_b64'|'raw_string', value } | null
 */
function extractQrFromResponse(data) {
  if (!data || typeof data !== "object") return null;

  const candidates = [
    data?.qrcode?.base64,
    data?.base64,
    data?.hash?.qrcode,
    data?.data?.qrcode?.base64,
    data?.data?.base64,
    data?.qrcode,
    data?.code,
    data?.pairingCode,
    data?.data?.qrcode,
    data?.data?.code,
  ];

  for (const val of candidates) {
    if (!val || typeof val !== "string" || val.length < 10) continue;

    if (val.startsWith("data:image/")) {
      return { type: "png_b64", value: val };
    }

    if (val.length >= 100 && /^[A-Za-z0-9+/]+=*$/.test(val)) {
      return { type: "png_b64", value: `data:image/png;base64,${val}` };
    }

    if (val.startsWith("1@") || val.startsWith("2@") || val.includes(",")) {
      return { type: "raw_string", value: val };
    }
  }

  return null;
}

/**
 * Converte string QR matrix para PNG base64.
 * Retorna null se falhar.
 */
async function qrStringToPngBase64(qrString) {
  try {
    return await QRCode.toDataURL(qrString, {
      width: 300,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#FFFFFF" },
    });
  } catch (err) {
    console.error("[whatsapp/connect] Falha ao gerar PNG do QR string:", err.message);
    return null;
  }
}

const auth = [authMiddleware, activeMiddleware];

// POST /api/whatsapp/connect
router.post("/connect", ...auth, async (req, res) => {
  const usuarioId = req.user.id;
  const instanceName = buildInstanceName(usuarioId);

  try {
    const { rows: existing } = await query(
      "SELECT id, status FROM whatsapp_sessions WHERE usuario_id = $1",
      [usuarioId]
    );

    if (existing.length) {
      const sess = existing[0];
      if (sess.status === "connected") {
        return res.status(409).json({
          error: "WhatsApp ja esta conectado. Desconecte antes de reconectar.",
          status: "connected",
        });
      }
      await logoutInstance(instanceName);
      await deleteInstance(instanceName);
      await query("DELETE FROM whatsapp_sessions WHERE usuario_id = $1", [usuarioId]);
    }

    const webhookSecret = crypto.randomBytes(32).toString("hex");
    const webhookUrl = buildWebhookUrl(instanceName, webhookSecret);

    // 1. Cria instancia na Evolution API
    let createResp;
    try {
      createResp = await createInstance({ instanceName, webhookUrl });
    } catch (err) {
      console.error("[whatsapp/connect] createInstance falhou:", err.message);
      throw err;
    }
    console.log(
      `[whatsapp/connect] createInstance keys: ${JSON.stringify(Object.keys(createResp || {}))}`
    );

    // 2. Solicita conexao / QR
    let connectResp = null;
    try {
      connectResp = await connectInstance(instanceName);
      console.log(
        `[whatsapp/connect] connectInstance keys: ${JSON.stringify(Object.keys(connectResp || {}))}`
      );
    } catch (err) {
      console.warn("[whatsapp/connect] connectInstance falhou (nao fatal):", err.message);
    }

    // 3. Extrai QR de qualquer resposta disponivel
    let qrBase64 = null;
    for (const resp of [createResp, connectResp]) {
      const extracted = extractQrFromResponse(resp);
      if (!extracted) continue;

      if (extracted.type === "png_b64") {
        qrBase64 = extracted.value;
        console.log("[whatsapp/connect] QR PNG base64 extraido da resposta.");
        break;
      }

      if (extracted.type === "raw_string") {
        console.log("[whatsapp/connect] QR raw string extraido - convertendo para PNG.");
        const png = await qrStringToPngBase64(extracted.value);
        if (png) {
          qrBase64 = png;
          console.log("[whatsapp/connect] QR PNG gerado com sucesso.");
          break;
        }
      }
    }

    if (!qrBase64) {
      console.log("[whatsapp/connect] QR nao disponivel na resposta - aguardando webhook QRCODE_UPDATED.");
    }

    // 4. Persiste sessao com QR (se disponivel)
    await query(
      `INSERT INTO whatsapp_sessions
         (usuario_id, instance_name, status, webhook_secret, qrcode_base64)
       VALUES ($1, $2, 'connecting', $3, $4)`,
      [usuarioId, instanceName, webhookSecret, qrBase64]
    );

    res.status(201).json({
      ok: true,
      status: "connecting",
      qr_available: !!qrBase64,
      message: qrBase64
        ? "Instancia criada. QR code disponivel."
        : "Instancia criada. Aguarde o QR code.",
    });
  } catch (err) {
    console.error("whatsapp/connect:", err.message);
    res.status(500).json({ error: "Erro ao conectar WhatsApp." });
  }
});

// GET /api/whatsapp/status
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

// GET /api/whatsapp/qrcode
router.get("/qrcode", ...auth, async (req, res) => {
  try {
    const { rows } = await query(
      "SELECT status, qrcode_base64 FROM whatsapp_sessions WHERE usuario_id = $1",
      [req.user.id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: "Nenhuma sessao encontrada." });
    }
    const sess = rows[0];
    if (sess.status === "connected") {
      return res.status(409).json({ error: "WhatsApp ja esta conectado." });
    }
    if (!sess.qrcode_base64) {
      return res.status(202).json({
        message: "QR code ainda nao disponivel. Aguarde alguns segundos.",
      });
    }
    res.json({ qrcode: sess.qrcode_base64 });
  } catch (err) {
    console.error("whatsapp/qrcode:", err.message);
    res.status(500).json({ error: "Erro ao obter QR code." });
  }
});

// POST /api/whatsapp/disconnect
router.post("/disconnect", ...auth, async (req, res) => {
  const usuarioId = req.user.id;
  const instanceName = buildInstanceName(usuarioId);

  try {
    const { rows } = await query(
      "SELECT id FROM whatsapp_sessions WHERE usuario_id = $1",
      [usuarioId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: "Nenhuma sessao WhatsApp encontrada." });
    }
    await logoutInstance(instanceName);
    await deleteInstance(instanceName);
    await query("DELETE FROM whatsapp_sessions WHERE usuario_id = $1", [usuarioId]);
    await query("DELETE FROM whatsapp_pending WHERE usuario_id = $1", [usuarioId]);
    res.json({ ok: true });
  } catch (err) {
    console.error("whatsapp/disconnect:", err.message);
    res.status(500).json({ error: "Erro ao desconectar WhatsApp." });
  }
});

// POST /api/whatsapp/webhook/:instanceName
router.post("/webhook/:instanceName", async (req, res) => {
  const { instanceName } = req.params;
  const secret = req.query.secret;

  res.json({ ok: true });

  try {
    const { rows } = await query(
      "SELECT usuario_id, webhook_secret FROM whatsapp_sessions WHERE instance_name = $1",
      [instanceName]
    );

    if (!rows.length) {
      console.warn(`[whatsapp/webhook] Instancia desconhecida: ${instanceName}`);
      return;
    }

    const sess = rows[0];

    const expected = Buffer.from(sess.webhook_secret);
    const received = Buffer.from(secret || "");
    if (
      expected.length !== received.length ||
      !crypto.timingSafeEqual(expected, received)
    ) {
      console.warn(`[whatsapp/webhook] Segredo invalido para instancia: ${instanceName}`);
      return;
    }

    const event = req.body?.event;
    const data  = req.body?.data;

    if (!event) return;

    if (event === "QRCODE_UPDATED") {
      const extracted = extractQrFromResponse(data);
      let qrBase64 = null;

      if (extracted && extracted.type === "png_b64") {
        qrBase64 = extracted.value;
      } else if (extracted && extracted.type === "raw_string") {
        qrBase64 = await qrStringToPngBase64(extracted.value);
      }

      if (!qrBase64) {
        qrBase64 = (data && data.qrcode && data.qrcode.base64) || (data && data.base64) || null;
      }

      if (!qrBase64) {
        console.warn(`[whatsapp/webhook] QRCODE_UPDATED sem QR valido para ${instanceName}`);
        return;
      }

      await query(
        "UPDATE whatsapp_sessions SET qrcode_base64 = $1, status = 'connecting', updated_at = NOW() WHERE instance_name = $2",
        [qrBase64, instanceName]
      );
      console.log(`[whatsapp/webhook] QR atualizado: ${instanceName}`);
      return;
    }

    if (event === "CONNECTION_UPDATE") {
      const state = data && data.state;

      if (state === "open") {
        const phoneNumber = (data.instance && data.instance.owner) || data.phoneNumber || null;
        await query(
          "UPDATE whatsapp_sessions SET status = 'connected', phone_number = COALESCE($1, phone_number), qrcode_base64 = NULL, updated_at = NOW() WHERE instance_name = $2",
          [phoneNumber, instanceName]
        );
        console.log(`[whatsapp/webhook] Conectado: ${instanceName} phone=${phoneNumber}`);

      } else if (state === "close") {
        await query(
          "UPDATE whatsapp_sessions SET status = 'disconnected', qrcode_base64 = NULL, updated_at = NOW() WHERE instance_name = $1",
          [instanceName]
        );
        console.log(`[whatsapp/webhook] Desconectado: ${instanceName}`);

      } else if (state === "connecting") {
        await query(
          "UPDATE whatsapp_sessions SET status = 'connecting', updated_at = NOW() WHERE instance_name = $1",
          [instanceName]
        );
      }
      return;
    }

  } catch (err) {
    console.error(`[whatsapp/webhook] Erro ao processar evento (${instanceName}):`, err.message);
  }
});

export { router as whatsappRouter };
