import { Router } from "express";
import crypto from "crypto";
import QRCode from "qrcode";
import { query } from "../db.js";
import { authMiddleware, activeMiddleware } from "../middleware/auth.js";
import {
  createInstance,
  connectInstance,
  fetchDirectConnectQr,
  fetchInstanceByName,
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

/** Log seguro: só chaves, nunca valores. */
function logQrcodeKeys(label, data) {
  const qr = data?.qrcode;
  if (qr && typeof qr === "object" && !Array.isArray(qr)) {
    console.log(`[whatsapp/${label}] qrcode keys:`, Object.keys(qr));
  }
}

function logHashShape(label, data) {
  const h = data?.hash;
  if (typeof h === "string") {
    console.log(`[whatsapp/${label}] hash: string (${h.length} chars)`);
  } else if (h && typeof h === "object") {
    console.log(`[whatsapp/${label}] hash keys:`, Object.keys(h));
  }
}

/** Normaliza nome do evento (qrcode.updated → QRCODE_UPDATED). */
function normalizeWebhookEvent(body) {
  const raw = (body?.event || body?.type || body?.action || "").toString();
  let event = raw.toUpperCase().replace(/\./g, "_");
  const data = body?.data ?? body;

  if (!event && data && (data.qrcode || data.base64 || data.code)) {
    event = "QRCODE_UPDATED";
  }

  return { event, data };
}

/** UUID/hash da instância — NÃO é pairing do WhatsApp. */
function looksLikeInstanceHash(s) {
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ||
    /^[0-9a-f]{32,64}$/i.test(s)
  );
}

/** Classifica uma string candidata a QR real do WhatsApp. */
function classifyQrString(val) {
  if (!val || typeof val !== "string") return null;
  const s = val.trim();
  if (s.length < 10) return null;

  if (s.startsWith("data:image/")) {
    return { type: "png_b64", value: s };
  }

  if (s.length >= 100 && /^[A-Za-z0-9+/]+=*$/.test(s)) {
    return { type: "png_b64", value: `data:image/png;base64,${s}` };
  }

  // Pairing Baileys: "2@xxx,yyy,zzz" — único formato seguro para gerar QR manualmente
  if (s.startsWith("1@") || s.startsWith("2@") || s.includes(",")) {
    return { type: "raw_string", value: s };
  }

  // Nunca converter hash/id curto da instância em QR falso
  if (looksLikeInstanceHash(s) || s.length < 50) {
    return null;
  }

  return null;
}

function timingSafeEqualStr(a, b) {
  const ba = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Valida webhook: ?secret=, header X-CenterFlow-Webhook-Secret ou apikey global Evolution. */
function validateWebhookAuth(sess, req) {
  const expected = sess.webhook_secret;

  if (timingSafeEqualStr(req.query.secret, expected)) return "query";

  const headerSecret =
    req.headers["x-centerflow-webhook-secret"] ||
    req.headers["x-webhook-secret"];
  if (timingSafeEqualStr(headerSecret, expected)) return "header";

  const evoKey = process.env.EVOLUTION_API_KEY;
  const incomingKey = req.headers.apikey || req.headers["api-key"];
  if (evoKey && incomingKey && timingSafeEqualStr(incomingKey, evoKey)) {
    return "apikey";
  }

  return null;
}

/** Ignora objetos placeholder da Evolution (ex.: { count: 0 }). */
function isQrContainer(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  const keys = Object.keys(obj);
  if (!keys.length) return false;
  return !(keys.length === 1 && keys[0] === "count");
}

/** Coleta strings candidatas de todos os formatos conhecidos da Evolution. */
function collectQrCandidates(data) {
  if (typeof data === "string") {
    const c = classifyQrString(data);
    return c ? [data] : [];
  }
  if (!data || typeof data !== "object") return [];

  const candidates = [];
  const seen = new Set();

  const push = (val) => {
    if (val == null) return;
    if (typeof val === "string") {
      if (!seen.has(val)) {
        seen.add(val);
        candidates.push(val);
      }
      return;
    }
    if (typeof val === "object" && !Array.isArray(val)) {
      if (!isQrContainer(val) && Object.keys(val).length <= 2 && "count" in val) return;
      push(val.base64);
      push(val.image);
      push(val.data);
      push(val.code);
      push(val.qr);
      push(val.url);
      push(val.pairingCode);
      push(val.qrcode);
    }
    if (Array.isArray(val)) {
      for (const item of val) push(item);
    }
  };

  const pushQrObject = (obj) => {
    if (!isQrContainer(obj)) return;
    push(obj.code);
    push(obj.qr);
    push(obj.base64);
    push(obj.image);
    push(obj.url);
    push(obj.pairingCode);
    push(obj.data);
    push(obj.qrcode);
  };

  if (typeof data.qrcode === "string") {
    push(data.qrcode);
  } else {
    pushQrObject(data.qrcode);
  }

  if (typeof data.hash === "string") {
    push(data.hash);
  } else {
    pushQrObject(data.hash);
  }

  pushQrObject(data.instance);

  // GET /instance/connect — campos no root e em data.*
  push(data.base64);
  push(data.code);
  push(data.qr);
  push(data.pairingCode);

  pushQrObject(data.data);
  push(data?.data?.base64);
  push(data?.data?.code);
  if (typeof data?.data?.qrcode === "string") {
    push(data.data.qrcode);
  } else {
    pushQrObject(data?.data?.qrcode);
  }

  pushQrObject(data.response);
  push(data?.response?.code);
  push(data?.response?.base64);
  push(data?.response?.qrcode);

  return candidates;
}

/**
 * Extrai QR code de uma resposta da Evolution API.
 * Retorna { type: 'png_b64'|'raw_string', value } | null
 */
function extractQrFromResponse(data) {
  const candidates = collectQrCandidates(data);
  for (const val of candidates) {
    const classified = classifyQrString(val);
    if (classified) return classified;
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

/** Tenta obter QR via fetchInstances (Evolution v2.1.1 às vezes só expõe QR aqui). */
async function fetchQrViaInstanceList(instanceName, logLabel) {
  try {
    const resp = await fetchInstanceByName(instanceName);
    const list = Array.isArray(resp) ? resp : resp ? [resp] : [];
    console.log(`[whatsapp/${logLabel}] fetchInstances count:`, list.length);

    for (const item of list) {
      if (item?.instance && typeof item.instance === "object") {
        console.log(`[whatsapp/${logLabel}] instance keys:`, Object.keys(item.instance));
      }
      const qr = await persistQrIfFound(instanceName, item, item?.qrcode, item?.instance);
      if (qr) return qr;
    }
  } catch (err) {
    console.warn(`[whatsapp/${logLabel}] fetchInstances falhou:`, err.message);
  }
  return null;
}

/**
 * Fallback: GET /instance/connect + fetchInstances.
 * Evolution v2.1.1 costuma retornar só { count } no connect — QR vem via webhook ou fetchInstances.
 */
async function fetchQrViaDirectConnect(instanceName, logLabel) {
  const attempts = 6;
  const delayMs = 2000;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (attempt > 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }

    let resp;
    try {
      resp = await fetchDirectConnectQr(instanceName);
    } catch (err) {
      console.warn(`[whatsapp/${logLabel}] directConnect falhou:`, err.message);
    }

    if (resp) {
      console.log(`[whatsapp/${logLabel}] directConnect keys:`, Object.keys(resp || {}));
      if (resp?.data && typeof resp.data === "object") {
        console.log(`[whatsapp/${logLabel}] directConnect data keys:`, Object.keys(resp.data));
      }
      const qr = await persistQrIfFound(instanceName, resp, resp?.data, resp?.response);
      if (qr) return qr;
    }

    const qrFromList = await fetchQrViaInstanceList(instanceName, logLabel);
    if (qrFromList) return qrFromList;
  }
  return null;
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

    const webhookBase = (process.env.WEBHOOK_BASE_URL || "").trim();
    if (!webhookBase) {
      console.error("[whatsapp/connect] WEBHOOK_BASE_URL nao configurada — QR via webhook nao funcionara");
      return res.status(503).json({
        error: "Servidor WhatsApp nao configurado (WEBHOOK_BASE_URL ausente). Contate o suporte.",
      });
    }

    // Limpa instância Evolution anterior (reconexão) — NÃO apaga sessão no banco (evita race com webhook)
    if (existing.length) {
      await logoutInstance(instanceName);
      await deleteInstance(instanceName);
    }

    const webhookSecret = crypto.randomBytes(32).toString("hex");
    const webhookUrl = buildWebhookUrl(instanceName, webhookSecret);

    // 1. Upsert sessão ANTES da Evolution — webhook QRCODE_UPDATED precisa encontrar o registro
    await saveConnectingSession(usuarioId, instanceName, webhookSecret, null);
    console.log(`[whatsapp/connect] sessao salva: ${instanceName}`);

    // 2. Cria instância e solicita QR na Evolution
    let createResp;
    try {
      createResp = await createInstance({ instanceName, webhookUrl, webhookSecret });
      console.log("[whatsapp/connect] createInstance keys:", Object.keys(createResp || {}));
      logQrcodeKeys("connect", createResp);
      logHashShape("connect", createResp);
      if (
        typeof createResp?.hash === "string" &&
        looksLikeInstanceHash(createResp.hash)
      ) {
        console.log(
          "[whatsapp/connect] hash e ID da instancia, nao QR WhatsApp — aguardando webhook"
        );
      }
      if (createResp?.instance && typeof createResp.instance === "object") {
        console.log("[whatsapp/connect] instance keys:", Object.keys(createResp.instance));
      }
    } catch (err) {
      console.error("[whatsapp/connect] createInstance falhou:", err.message);
      await failConnectingSession(usuarioId, instanceName);
      return res.status(500).json({ error: "Erro ao conectar WhatsApp." });
    }

    let connectResp = null;
    try {
      connectResp = await connectInstance(instanceName);
      console.log("[whatsapp/connect] connectInstance keys:", Object.keys(connectResp || {}));
      logQrcodeKeys("connect", connectResp);
    } catch (err) {
      console.warn("[whatsapp/connect] connectInstance falhou (nao fatal):", err.message);
    }

    // 3. Atualiza QR se veio na resposta síncrona
    let qrBase64 = await persistQrIfFound(
      instanceName,
      createResp,
      createResp?.hash,
      connectResp
    );

    // 4. Fallback: endpoint direto GET /instance/connect
    if (!qrBase64) {
      qrBase64 = await fetchQrViaDirectConnect(instanceName, "connect");
    }

    if (!qrBase64) {
      console.log("[whatsapp/connect] QR nao disponivel — aguardando webhook:", instanceName);
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

    // Sem QR no banco: fallback GET /instance/connect
    if (sess.status === "connecting" && !qr) {
      qr = await fetchQrViaDirectConnect(instanceName, "qrcode");
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
    const authVia = validateWebhookAuth(sess, req);

    if (!authVia) {
      console.warn(
        `[whatsapp/webhook] Segredo invalido: ${instanceName}` +
        ` (query=${!!req.query.secret} header=${!!req.headers["x-centerflow-webhook-secret"]} apikey=${!!req.headers.apikey})`
      );
      return;
    }

    console.log(`[whatsapp/webhook] auth ok via ${authVia}: ${instanceName}`);

    const { event, data } = normalizeWebhookEvent(req.body);

    if (!event) {
      console.warn(`[whatsapp/webhook] Evento ausente: ${instanceName}`);
      return;
    }

    console.log(`[whatsapp/webhook] evento: ${event} instancia: ${instanceName}`);

    if (event === "QRCODE_UPDATED") {
      const qrBase64 = await persistQrIfFound(instanceName, data, req.body);
      if (!qrBase64) {
        console.warn(`[whatsapp/webhook] QRCODE_UPDATED sem QR valido: ${instanceName}`);
        logQrcodeKeys("webhook", data);
        logHashShape("webhook", data);
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
