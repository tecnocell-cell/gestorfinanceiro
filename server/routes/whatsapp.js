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

async function qrStringToPngBase64(qrString) {
  try {
    return await QRCode.toDataURL(qrString, {
      width: 300,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#FFFFFF" },
    });
  } catch (err) {
    console.error("[whatsapp] Falha ao gerar PNG do QR string:", err.message);
    return null;
  }
}

/** Converte respostas da Evolution em data URL PNG, se possível. */
async function qrFromEvolutionResponses(...responses) {
  for (const resp of responses) {
    if (!resp) continue;
    const extracted = extractQrFromResponse(resp);
    if (!extracted) continue;

    if (extracted.type === "png_b64") return extracted.value;

    if (extracted.type === "raw_string") {
      const png = await qrStringToPngBase64(extracted.value);
      if (png) return png;
    }
  }
  return null;
}

/** Persiste QR no banco quando encontrado. */
async function persistQrIfFound(instanceName, ...responses) {
  const qrBase64 = await qrFromEvolutionResponses(...responses);
  if (!qrBase64) return null;

  await query(
    `UPDATE whatsapp_sessions
     SET qrcode_base64 = $1, status = 'connecting', updated_at = NOW()
     WHERE instance_name = $2`,
    [qrBase64, instanceName]
  );
  return qrBase64;
}

/** Salva sessão em connecting ANTES de chamar a Evolution (webhook precisa encontrar o registro). */
async function saveConnectingSession(usuarioId, instanceName, webhookSecret, qrcodeBase64 = null) {
  await query(
    `INSERT INTO whatsapp_sessions
       (usuario_id, instance_name, status, webhook_secret, qrcode_base64)
     VALUES ($1, $2, 'connecting', $3, $4)
     ON CONFLICT (usuario_id) DO UPDATE SET
       instance_name   = EXCLUDED.instance_name,
       status          = 'connecting',
       webhook_secret  = EXCLUDED.webhook_secret,
       qrcode_base64   = EXCLUDED.qrcode_base64,
       phone_number    = NULL,
       updated_at      = NOW()`,
    [usuarioId, instanceName, webhookSecret, qrcodeBase64]
  );
}

/** Limpa Evolution e marca sessão como disconnected após falha no connect. */
async function failConnectingSession(usuarioId, instanceName) {
  try {
    await logoutInstance(instanceName);
    await deleteInstance(instanceName);
  } catch {
    // instância pode não existir — ok
  }
  await query(
    `UPDATE whatsapp_sessions
     SET status = 'disconnected', qrcode_base64 = NULL, updated_at = NOW()
     WHERE usuario_id = $1`,
    [usuarioId]
  );
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

    if (existing.length && existing[0].status === "connected") {
      return res.status(409).json({
        error: "WhatsApp ja esta conectado. Desconecte antes de reconectar.",
        status: "connected",
      });
    }

    // Limpa instância Evolution anterior (reconexão)
    if (existing.length) {
      await logoutInstance(instanceName);
      await deleteInstance(instanceName);
      await query("DELETE FROM whatsapp_sessions WHERE usuario_id = $1", [usuarioId]);
    }

    const webhookSecret = crypto.randomBytes(32).toString("hex");
    const webhookUrl = buildWebhookUrl(instanceName, webhookSecret);

    // 1. Persiste sessão ANTES da Evolution — webhook QRCODE_UPDATED precisa encontrar o registro
    await saveConnectingSession(usuarioId, instanceName, webhookSecret, null);

    // 2. Cria instância e solicita QR na Evolution
    let createResp;
    try {
      createResp = await createInstance({ instanceName, webhookUrl });
    } catch (err) {
      console.error("[whatsapp/connect] createInstance falhou:", err.message);
      await failConnectingSession(usuarioId, instanceName);
      return res.status(500).json({ error: "Erro ao conectar WhatsApp." });
    }

    let connectResp = null;
    try {
      connectResp = await connectInstance(instanceName);
    } catch (err) {
      console.warn("[whatsapp/connect] connectInstance falhou (nao fatal):", err.message);
    }

    // 3. Atualiza QR se veio na resposta síncrona (webhook também pode preencher depois)
    const qrBase64 = await persistQrIfFound(instanceName, createResp, connectResp);

    if (!qrBase64) {
      console.log("[whatsapp/connect] QR aguardando webhook QRCODE_UPDATED:", instanceName);
    }

    res.status(201).json({
      ok: true,
      status: "connecting",
      qr_available: !!qrBase64,
      message: qrBase64
        ? "Instancia criada. QR code disponivel."
        : "Instancia criada. Aguarde o QR code.",
    });
  } catch (err) {
    console.error("[whatsapp/connect]:", err.message);
    try {
      await failConnectingSession(usuarioId, instanceName);
    } catch {
      // melhor esforço
    }
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
    console.error("[whatsapp/status]:", err.message);
    res.status(500).json({ error: "Erro ao verificar status." });
  }
});

// GET /api/whatsapp/qrcode
router.get("/qrcode", ...auth, async (req, res) => {
  const usuarioId = req.user.id;
  const instanceName = buildInstanceName(usuarioId);

  try {
    const { rows } = await query(
      "SELECT status, qrcode_base64 FROM whatsapp_sessions WHERE usuario_id = $1",
      [usuarioId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: "Nenhuma sessao encontrada." });
    }

    const sess = rows[0];
    if (sess.status === "connected") {
      return res.status(409).json({ error: "WhatsApp ja esta conectado." });
    }

    let qr = sess.qrcode_base64;

    // Sem QR no banco: tenta buscar novamente na Evolution
    if (sess.status === "connecting" && !qr) {
      try {
        const connectResp = await connectInstance(instanceName);
        qr = await persistQrIfFound(instanceName, connectResp);
      } catch (err) {
        console.warn("[whatsapp/qrcode] connectInstance retry falhou:", err.message);
      }
    }

    if (!qr) {
      return res.status(202).json({
        message: "QR code ainda nao disponivel. Aguarde alguns segundos.",
      });
    }

    res.json({ qrcode: qr });
  } catch (err) {
    console.error("[whatsapp/qrcode]:", err.message);
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
    console.error("[whatsapp/disconnect]:", err.message);
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
      const qrBase64 = await persistQrIfFound(instanceName, data);
      if (!qrBase64) {
        console.warn(`[whatsapp/webhook] QRCODE_UPDATED sem QR valido: ${instanceName}`);
        return;
      }
      console.log(`[whatsapp/webhook] QR atualizado: ${instanceName}`);
      return;
    }

    if (event === "CONNECTION_UPDATE") {
      const state = data && data.state;

      if (state === "open") {
        const phoneNumber = (data.instance && data.instance.owner) || data.phoneNumber || null;
        await query(
          `UPDATE whatsapp_sessions
           SET status = 'connected', phone_number = COALESCE($1, phone_number),
               qrcode_base64 = NULL, updated_at = NOW()
           WHERE instance_name = $2`,
          [phoneNumber, instanceName]
        );
        console.log(`[whatsapp/webhook] Conectado: ${instanceName}`);

      } else if (state === "close") {
        await query(
          `UPDATE whatsapp_sessions
           SET status = 'disconnected', qrcode_base64 = NULL, updated_at = NOW()
           WHERE instance_name = $1`,
          [instanceName]
        );
        console.log(`[whatsapp/webhook] Desconectado: ${instanceName}`);

      } else if (state === "connecting") {
        await query(
          `UPDATE whatsapp_sessions SET status = 'connecting', updated_at = NOW() WHERE instance_name = $1`,
          [instanceName]
        );
      }
    }
  } catch (err) {
    console.error(`[whatsapp/webhook] Erro (${instanceName}):`, err.message);
  }
});

export { router as whatsappRouter };
