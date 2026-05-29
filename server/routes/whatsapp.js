import { Router } from "express";
import crypto from "crypto";
import QRCode from "qrcode";
import { query } from "../db.js";
import { authMiddleware, activeMiddleware } from "../middleware/auth.js";
import {
  createInstance,
  connectInstance,
  fetchInstanceByName,
  logoutInstance,
  deleteInstance,
  gatewayHealth,
} from "../whatsapp/evolutionProvider.js";

const router = Router();

/** Cooldowns — chamadas repetidas a /instance/connect derrubam a sessão na Evolution v2.1.1 */
const evoFetchListCooldown = new Map();
const evo404Warned = new Set();
const lastWebhookConnState = new Map();
const lastCloseIgnoreLog = new Map();
const FETCH_INSTANCES_COOLDOWN_MS = 8_000;
const QR_WAIT_TIMEOUT_MS = 120_000;

const STALE_SESSION = Symbol("STALE_SESSION");

const QR_TIMEOUT_MSG = "QR code não recebido. Tente reconectar.";

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

/**
 * Normaliza qualquer representacao de JID/numero para so digitos.
 *   "5599999999999:1@s.whatsapp.net" → "5599999999999"
 *   "5599999999999@s.whatsapp.net"   → "5599999999999"
 *   "5599999999999"                  → "5599999999999"
 * Retorna null se o resultado nao for 7-15 digitos.
 */
function normalizeJidToPhone(raw) {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  const beforeAt = s.includes("@") ? s.slice(0, s.indexOf("@")) : s;
  const colon    = beforeAt.indexOf(":");
  const phone    = colon >= 0 ? beforeAt.slice(0, colon) : beforeAt;
  return /^\d{7,15}$/.test(phone) ? phone : null;
}

/**
 * Varre todos os formatos possiveis de numero no payload do webhook CONNECTION_UPDATE.
 * Tenta em ordem de confiabilidade; retorna o primeiro resultado valido.
 *
 * @param {object} data  - body.data (ou body quando body.data ausente)
 * @param {object} body  - req.body bruto (fallback)
 */
function extractPhoneFromWebhookPayload(data, body) {
  const candidates = [
    // Campos do payload principal (ja normalizados pelo Gateway)
    data?.phone,
    data?.number,
    data?.phoneNumber,
    data?.ownerJid,
    // JID bruto — normalizeJidToPhone remove ":1@s.whatsapp.net"
    data?.jid,
    // Campos aninhados em data.data (alguns wrappers duplicam o payload)
    data?.data?.phone,
    data?.data?.number,
    data?.data?.phoneNumber,
    data?.data?.ownerJid,
    data?.data?.jid,
    data?.data?.instance?.owner,
    data?.data?.instance?.ownerJid,
    // Campos do objeto instance dentro do payload
    data?.instance?.owner,
    data?.instance?.ownerJid,
    // Fallback: root do body (quando normalizeWebhookEvent retornou data=body)
    body?.phone,
    body?.number,
    body?.phoneNumber,
    body?.ownerJid,
    body?.jid,
    body?.instance?.owner,
    body?.instance?.ownerJid,
  ];

  for (const candidate of candidates) {
    const phone = normalizeJidToPhone(candidate);
    if (phone) return phone;
  }
  return null;
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
  push(data.qrcode_base64);

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

/** Instância não existe mais na Evolution — reseta sessão local para parar poll com 404. */
async function failQrWaitTimeout(instanceName, logLabel) {
  await query(
    `UPDATE whatsapp_sessions
     SET status = 'disconnected', qrcode_base64 = NULL, updated_at = NOW()
     WHERE instance_name = $1`,
    [instanceName]
  );
  console.error(`[whatsapp/${logLabel}] ${QR_TIMEOUT_MSG} (${instanceName})`);
}

/** Uma tentativa de /connect após 6s (não bloqueia resposta HTTP). */
function scheduleDelayedQrFetch(instanceName) {
  setTimeout(async () => {
    try {
      const resp = await connectInstance(instanceName);
      const qr = await persistQrIfFound(instanceName, resp);
      if (qr) {
        console.log(`[whatsapp/connect] QR obtido via connect atrasado: ${instanceName}`);
      }
    } catch (err) {
      if (err.status !== 404) {
        console.warn("[whatsapp/connect] connect atrasado falhou:", err.message);
      }
    }
  }, 6_000);
}

async function resetStaleSession(usuarioId, instanceName, logLabel) {
  await query(
    `UPDATE whatsapp_sessions
     SET status = 'disconnected', qrcode_base64 = NULL, updated_at = NOW()
     WHERE usuario_id = $1`,
    [usuarioId]
  );
  const warnKey = `${instanceName}:404`;
  if (!evo404Warned.has(warnKey)) {
    evo404Warned.add(warnKey);
    console.warn(
      `[whatsapp/${logLabel}] instancia ausente na Evolution (404) — sessao local resetada. Reconecte pelo app.`
    );
  }
}

/** Tenta obter QR via fetchInstances (Evolution v2.1.1 às vezes só expõe QR aqui). */
async function fetchQrViaInstanceList(instanceName, logLabel, usuarioId = null) {
  try {
    const resp = await fetchInstanceByName(instanceName);
    const list = Array.isArray(resp) ? resp : resp ? [resp] : [];

    if (!list.length) {
      if (usuarioId) {
        await resetStaleSession(usuarioId, instanceName, logLabel);
        return STALE_SESSION;
      }
      return null;
    }

    console.log(`[whatsapp/${logLabel}] fetchInstances count:`, list.length);

    for (const item of list) {
      console.log(`[whatsapp/${logLabel}] fetchInstances item keys:`, Object.keys(item || {}));
      if (item?.instance && typeof item.instance === "object") {
        console.log(`[whatsapp/${logLabel}] instance keys:`, Object.keys(item.instance));
      }
      logQrcodeKeys(logLabel, item);
      const qr = await persistQrIfFound(instanceName, item, item?.qrcode, item?.instance);
      if (qr) return qr;
    }
  } catch (err) {
    if (err.status === 404 && usuarioId) {
      await resetStaleSession(usuarioId, instanceName, logLabel);
      return STALE_SESSION;
    }
    if (err.status === 404) {
      const warnKey = `${instanceName}:404`;
      if (!evo404Warned.has(warnKey)) {
        evo404Warned.add(warnKey);
        console.warn(`[whatsapp/${logLabel}] instancia ausente na Evolution (404)`);
      }
      return STALE_SESSION;
    }
    console.warn(`[whatsapp/${logLabel}] fetchInstances falhou:`, err.message);
  }
  return null;
}

/**
 * Consulta fetchInstances com cooldown (sem chamar /instance/connect).
 * Repetir /connect a cada poll derruba a sessão e gera loop CONNECTION_UPDATE close.
 */
async function fetchQrPassive(instanceName, logLabel, { force = false, usuarioId = null } = {}) {
  const now = Date.now();
  const last = evoFetchListCooldown.get(instanceName) || 0;
  if (!force && now - last < FETCH_INSTANCES_COOLDOWN_MS) {
    return null;
  }
  evoFetchListCooldown.set(instanceName, now);
  return fetchQrViaInstanceList(instanceName, logLabel, usuarioId);
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

    // 4. Uma consulta passiva (sem repetir /connect)
    if (!qrBase64) {
      qrBase64 = await fetchQrPassive(instanceName, "connect", {
        force: true,
        usuarioId,
      });
      if (qrBase64 === STALE_SESSION) qrBase64 = null;
    }

    if (!qrBase64) {
      console.log("[whatsapp/connect] QR aguardando webhook QRCODE_UPDATED:", instanceName);
      scheduleDelayedQrFetch(instanceName);
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
  const instanceName = buildInstanceName(req.user.id);

  try {
    const { rows } = await query(
      `SELECT status, phone_number, qrcode_base64, updated_at
       FROM whatsapp_sessions WHERE usuario_id = $1`,
      [req.user.id]
    );
    if (!rows.length) {
      return res.json({
        status: "disconnected",
        phone_number: null,
        qrcode: null,
        waiting_qr: false,
        waiting_seconds: 0,
      });
    }

    const row = rows[0];
    const ageMs = row.updated_at
      ? Date.now() - new Date(row.updated_at).getTime()
      : 0;

    if (
      row.status === "connecting" &&
      !row.qrcode_base64 &&
      ageMs >= QR_WAIT_TIMEOUT_MS
    ) {
      await failQrWaitTimeout(instanceName, "status");
      return res.json({
        status: "disconnected",
        phone_number: null,
        qrcode: null,
        waiting_qr: false,
        waiting_seconds: 0,
        error: QR_TIMEOUT_MSG,
      });
    }

    res.json({
      status: row.status,
      phone_number: row.phone_number || null,
      qrcode: row.qrcode_base64 || null,
      waiting_qr: row.status === "connecting" && !row.qrcode_base64,
      waiting_seconds: row.status === "connecting" ? Math.round(ageMs / 1000) : 0,
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

    // Sem QR: só lê fetchInstances (cooldown) — nunca chama /instance/connect no poll
    if (sess.status === "connecting" && !qr) {
      const passive = await fetchQrPassive(instanceName, "qrcode", { usuarioId });
      if (passive === STALE_SESSION) {
        return res.status(410).json({
          error: "Sessao expirada. Clique em Conectar WhatsApp novamente.",
          status: "disconnected",
        });
      }
      if (passive) qr = passive;
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
    // ── Resolve sessao: instancia admin (PF) ou usuario (PJ) ─────────────────
    const pfCfg = await getPfConfig();
    const isAdminInstance = !!(pfCfg.adminInstance && instanceName === pfCfg.adminInstance);

    let sess;
    if (isAdminInstance) {
      const { rows: scRows } = await query(
        "SELECT value FROM system_config WHERE key = 'whatsapp_admin_webhook_secret'"
      );
      const adminSecret = scRows[0]?.value || null;
      sess = { webhook_secret: adminSecret, usuario_id: null };
    } else {
      const { rows } = await query(
        "SELECT usuario_id, webhook_secret FROM whatsapp_sessions WHERE instance_name = $1",
        [instanceName]
      );
      if (!rows.length) {
        console.warn(`[whatsapp/webhook] Instancia desconhecida: ${instanceName}`);
        return;
      }
      sess = rows[0];
    }

    const authVia = validateWebhookAuth(sess, req);

    if (!authVia) {
      console.warn(
        `[whatsapp/webhook] Segredo invalido: ${instanceName}` +
        ` (query=${!!req.query.secret} header=${!!req.headers["x-centerflow-webhook-secret"]} apikey=${!!req.headers.apikey})`
      );
      return;
    }

    const { event, data } = normalizeWebhookEvent(req.body);

    if (!event) {
      console.warn(`[whatsapp/webhook] Evento ausente: ${instanceName}`);
      return;
    }

    if (event === "QRCODE_UPDATED") {
      console.log(`[whatsapp/webhook] QRCODE_UPDATED via ${authVia}: ${instanceName}`);
      if (isAdminInstance) {
        // Armazena QR da instancia admin em system_config
        const qrBase64 = await qrFromEvolutionResponses(data, req.body);
        if (!qrBase64) {
          console.warn(`[whatsapp/webhook] QRCODE_UPDATED sem QR valido (admin): ${instanceName}`);
          logQrcodeKeys("webhook", data);
          logHashShape("webhook", data);
          return;
        }
        await query(
          `INSERT INTO system_config (key, value) VALUES ('whatsapp_admin_qrcode', $1)
           ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
          [qrBase64]
        );
        await query(
          `INSERT INTO system_config (key, value) VALUES ('whatsapp_admin_status', 'connecting')
           ON CONFLICT (key) DO UPDATE SET value = 'connecting', updated_at = NOW()`
        );
        _pfConfigCache = null;
        console.log(`[whatsapp/webhook] QR admin atualizado: ${instanceName}`);
        return;
      }
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

    if (event === "MESSAGES_UPSERT") {
      const fromNumber = data?.fromNumber || data?.from || req.body?.fromNumber || null;
      const msgBody    = data?.body       || data?.text || req.body?.body       || "";

      if (isAdminInstance) {
        // ── Modo PF: allowlist obrigatoria ──────────────────────────────
        const authRow = await lookupAuthorizedPhone(fromNumber);
        if (!authRow) {
          console.warn(
            `[whatsapp/webhook] MESSAGES_UPSERT PF -- numero NAO autorizado: ${fromNumber || "?"}`
          );
          return;
        }
        query(
          "UPDATE whatsapp_authorized_numbers SET last_used_at = NOW() WHERE id = $1",
          [authRow.id]
        ).catch(() => {});
        console.log(
          `[whatsapp/webhook] MESSAGES_UPSERT PF usuario=${authRow.usuario_id}` +
          ` from=${fromNumber} body=${String(msgBody).slice(0, 120)}`
        );
        // TODO Fase 3b: processar mensagem para usuario PF authRow.usuario_id

      } else {
        // ── Modo PJ: verificar allowlist do tenant ──────────────────────
        const allowed = await isPjFromNumberAllowed(sess.usuario_id, fromNumber);
        if (!allowed) {
          console.warn(
            `[whatsapp/webhook] MESSAGES_UPSERT PJ -- numero NAO autorizado: ` +
            `instance=${instanceName} from=${fromNumber || "?"}`
          );
          return;
        }
        if (fromNumber) {
          query(
            `UPDATE whatsapp_authorized_numbers SET last_used_at = NOW()
             WHERE usuario_id = $1 AND phone_number = $2 AND active = true`,
            [sess.usuario_id, fromNumber]
          ).catch(() => {});
        }
        console.log(
          `[whatsapp/webhook] MESSAGES_UPSERT PJ instance=${instanceName}` +
          ` usuario=${sess.usuario_id} from=${fromNumber || "?"} body=${String(msgBody).slice(0, 120)}`
        );
        // TODO Fase 3b: processar mensagem para tenant sess.usuario_id
      }
      return;
    }

    if (event === "CONNECTION_UPDATE") {
      const state =
        data?.state || data?.status || data?.connection ||
        data?.data?.state || data?.data?.status || data?.data?.connection;

      if (state === "open") {
        const phoneNumber = extractPhoneFromWebhookPayload(data, req.body);

        if (isAdminInstance) {
          await query(
            `INSERT INTO system_config (key, value) VALUES ('whatsapp_admin_status', 'connected')
             ON CONFLICT (key) DO UPDATE SET value = 'connected', updated_at = NOW()`
          );
          await query(
            `INSERT INTO system_config (key, value) VALUES ('whatsapp_admin_qrcode', '')
             ON CONFLICT (key) DO UPDATE SET value = '', updated_at = NOW()`
          );
          if (phoneNumber) {
            await query(
              `INSERT INTO system_config (key, value) VALUES ('whatsapp_admin_phone', $1)
               ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
              [phoneNumber]
            );
          }
          _pfConfigCache = null;
          console.log(`[whatsapp/webhook] Admin conectado: ${instanceName} phone=${phoneNumber || "?"}`);
          return;
        }

        console.log(
          `[whatsapp/webhook] CONNECTION_UPDATE open -- payload keys:`,
          Object.keys(data || {})
        );
        await query(
          `UPDATE whatsapp_sessions
             SET status = 'connected', phone_number = $1,
                 qrcode_base64 = NULL, updated_at = NOW()
           WHERE instance_name = $2`,
          [phoneNumber, instanceName]
        );
        if (phoneNumber) {
          console.log(`[whatsapp/webhook] Conectado: ${instanceName} phone=${phoneNumber}`);
        } else {
          console.warn(`[whatsapp/webhook] conectado sem phone_number: ${instanceName}`);
        }
        return;
      }

      if (state === "close" || state === "closed") {
        if (isAdminInstance) {
          await query(
            `INSERT INTO system_config (key, value) VALUES ('whatsapp_admin_status', 'disconnected')
             ON CONFLICT (key) DO UPDATE SET value = 'disconnected', updated_at = NOW()`
          );
          await query(
            `INSERT INTO system_config (key, value) VALUES ('whatsapp_admin_qrcode', '')
             ON CONFLICT (key) DO UPDATE SET value = '', updated_at = NOW()`
          );
          _pfConfigCache = null;
          console.log(`[whatsapp/webhook] Admin desconectado: ${instanceName}`);
          return;
        }
        await query(
          `UPDATE whatsapp_sessions
             SET status = 'disconnected', qrcode_base64 = NULL, updated_at = NOW()
           WHERE instance_name = $1`,
          [instanceName]
        );
        console.log(`[whatsapp/webhook] Desconectado: ${instanceName}`);
        return;
      }

      if (state === "connecting") {
        console.log(`[whatsapp/webhook] Conectando: ${instanceName}`);
        return;
      }

      console.log(
        `[whatsapp/webhook] CONNECTION_UPDATE estado desconhecido: ${instanceName} state=${state}`
      );
      return;
    }

  } catch (err) {
    console.error(`[whatsapp/webhook] Erro: ${instanceName}:`, err.message);
  }
});

// GET /api/whatsapp/gateway-health
// Retorna sempre HTTP 200 -- evita que api.js intercepte 503 como "backend offline"
router.get("/gateway-health", ...auth, async (_req, res) => {
  try {
    const data = await gatewayHealth();
    res.json({ ok: true, gateway: data });
  } catch (err) {
    const isTimeout = err.message?.includes("timeout");
    res.json({
      ok: false,
      error: isTimeout
        ? "Gateway WhatsApp nao respondeu a tempo. Verifique se o servico esta rodando."
        : "Gateway WhatsApp inacessivel. Verifique a conexao com CT103.",
    });
  }
});


// ─── Helpers PF (Pessoa Fisica) ──────────────────────────────────────────────

/**
 * Busca o admin_instance e admin_phone da tabela system_config.
 * Cache simples em memoria (60s) para nao bater no banco a cada mensagem.
 */
let _pfConfigCache = null;
let _pfConfigTs    = 0;
const PF_CONFIG_TTL = 60_000;

async function getPfConfig() {
  const now = Date.now();
  if (_pfConfigCache && now - _pfConfigTs < PF_CONFIG_TTL) return _pfConfigCache;
  const { rows } = await query(
    "SELECT key, value FROM system_config WHERE key IN ('whatsapp_admin_instance','whatsapp_admin_phone')"
  );
  const cfg = Object.fromEntries(rows.map(r => [r.key, r.value]));
  _pfConfigCache = {
    adminInstance: cfg.whatsapp_admin_instance || null,
    adminPhone:    cfg.whatsapp_admin_phone    || null,
  };
  _pfConfigTs = now;
  return _pfConfigCache;
}

/**
 * Normaliza telefone para apenas digitos.
 */
function digitsOnly(raw) {
  if (!raw || typeof raw !== "string") return "";
  return raw.replace(/\D/g, "");
}

/**
 * Busca entrada ativa na allowlist pelo numero de telefone.
 * Tenta exato e sem DDI 55.
 * @param {string} fromNumber
 * @returns {object|null} linha de whatsapp_authorized_numbers ou null
 */
async function lookupAuthorizedPhone(fromNumber) {
  if (!fromNumber) return null;
  const digits = digitsOnly(fromNumber);
  if (!digits) return null;

  const { rows } = await query(
    `SELECT id, usuario_id, phone_number, label
       FROM whatsapp_authorized_numbers
      WHERE phone_number = $1 AND active = true
      LIMIT 1`,
    [digits]
  );
  if (rows.length) return rows[0];

  // Fallback sem DDI 55 (Baileys as vezes entrega sem o 55)
  if (digits.length >= 12 && digits.startsWith("55")) {
    const sem55 = digits.slice(2);
    const { rows: r2 } = await query(
      `SELECT id, usuario_id, phone_number, label
         FROM whatsapp_authorized_numbers
        WHERE phone_number = $1 AND active = true
        LIMIT 1`,
      [sem55]
    );
    if (r2.length) return r2[0];
  }
  return null;
}

/**
 * Verifica se fromNumber e permitido para um tenant PJ.
 *
 * Regra:
 *   - Se nenhuma entrada cadastrada para usuario_id: aceitar apenas
 *     o phone_number da sessao (whatsapp_sessions.phone_number).
 *   - Se houver entradas: aceitar apenas active = true.
 *
 * @param {string} usuarioId
 * @param {string|null} fromNumber - numero ja normalizado (so digitos)
 * @returns {Promise<boolean>}
 */
async function isPjFromNumberAllowed(usuarioId, fromNumber) {
  // Sem numero de origem: nao autorizado
  if (!fromNumber) return false;
  const digits = digitsOnly(fromNumber);
  if (!digits) return false;

  // Verificar allowlist do tenant
  const { rows: allowList } = await query(
    "SELECT phone_number FROM whatsapp_authorized_numbers WHERE usuario_id = $1",
    [usuarioId]
  );

  if (allowList.length === 0) {
    // Sem allowlist: aceitar apenas o dono da sessao
    const { rows: sess } = await query(
      "SELECT phone_number FROM whatsapp_sessions WHERE usuario_id = $1 LIMIT 1",
      [usuarioId]
    );
    if (!sess.length || !sess[0].phone_number) return false;
    const sessPhone = digitsOnly(sess[0].phone_number);
    return digits === sessPhone || (digits.length >= 12 && digits.startsWith("55") && digits.slice(2) === sessPhone);
  }

  // Com allowlist: verificar active = true
  const { rows: active } = await query(
    `SELECT id FROM whatsapp_authorized_numbers
      WHERE usuario_id = $1 AND active = true
        AND (phone_number = $2 OR phone_number = $3)
      LIMIT 1`,
    [usuarioId, digits, digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits]
  );
  return active.length > 0;
}

// GET /api/whatsapp/pf-config
// Retorna o numero oficial do CenterFlow para exibir no frontend PF.
// Nao requer autenticacao admin -- qualquer usuario autenticado pode saber o numero oficial.
router.get("/pf-config", ...auth, async (_req, res) => {
  try {
    const cfg = await getPfConfig();
    res.json({
      admin_phone:    cfg.adminPhone    || null,
      admin_instance: cfg.adminInstance || null,
    });
  } catch (err) {
    console.error("[whatsapp/pf-config]:", err.message);
    res.status(500).json({ error: "Erro ao buscar configuracao PF." });
  }
});


// GET /api/whatsapp/my-authorized  (alias legado)
// GET /api/whatsapp/authorized
// Retorna os numeros autorizados do proprio usuario.
async function handleGetAuthorized(req, res) {
  try {
    const { rows } = await query(
      `SELECT id, phone_number, label, active, verified_at, last_used_at, created_at
         FROM whatsapp_authorized_numbers
        WHERE usuario_id = $1
        ORDER BY created_at ASC`,
      [req.user.id]
    );
    res.json({ authorized: rows });
  } catch (err) {
    console.error("[whatsapp/authorized GET]:", err.message);
    res.status(500).json({ error: "Erro ao buscar numeros autorizados." });
  }
}
router.get("/my-authorized", ...auth, handleGetAuthorized);
router.get("/authorized",    ...auth, handleGetAuthorized);

// POST /api/whatsapp/authorized
// Body: { phone_number, label? }
// usuario_id sempre inferido do JWT — nunca aceitar do body.
router.post("/authorized", ...auth, async (req, res) => {
  const { phone_number, label = "" } = req.body || {};
  const usuarioId = req.user.id;

  const phone = (phone_number || "").replace(/\D/g, "");
  if (!phone || !/^\d{8,15}$/.test(phone)) {
    return res.status(400).json({ error: "Formato de telefone invalido." });
  }

  try {
    const { rows } = await query(
      `INSERT INTO whatsapp_authorized_numbers (usuario_id, phone_number, label)
       VALUES ($1, $2, $3)
       RETURNING id, phone_number, label, active, verified_at, last_used_at, created_at`,
      [usuarioId, phone, String(label).trim()]
    );
    res.status(201).json({ authorized: rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Este numero ja esta cadastrado." });
    }
    console.error("[whatsapp/authorized POST]:", err.message);
    res.status(500).json({ error: "Erro ao cadastrar numero." });
  }
});

// PATCH /api/whatsapp/authorized/:id
// Body: { active?, label? }
// Apenas o proprio usuario pode atualizar seus numeros.
router.patch("/authorized/:id", ...auth, async (req, res) => {
  const { id } = req.params;
  const { active, label } = req.body || {};
  const usuarioId = req.user.id;

  const sets = [];
  const vals = [];
  let i = 1;

  if (active !== undefined) { sets.push(`active = $${i++}`); vals.push(!!active); }
  if (label  !== undefined) { sets.push(`label  = $${i++}`); vals.push(String(label).trim()); }

  if (!sets.length) return res.status(400).json({ error: "Nenhum campo para atualizar." });

  vals.push(id, usuarioId);
  try {
    const { rows } = await query(
      `UPDATE whatsapp_authorized_numbers
          SET ${sets.join(", ")}, updated_at = NOW()
        WHERE id = $${i} AND usuario_id = $${i + 1}
        RETURNING id, phone_number, label, active, verified_at, last_used_at, created_at`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error: "Numero nao encontrado." });
    res.json({ authorized: rows[0] });
  } catch (err) {
    console.error("[whatsapp/authorized PATCH]:", err.message);
    res.status(500).json({ error: "Erro ao atualizar numero." });
  }
});

// DELETE /api/whatsapp/authorized/:id
// Apenas o proprio usuario pode remover seus numeros.
router.delete("/authorized/:id", ...auth, async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.user.id;
  try {
    const { rowCount } = await query(
      "DELETE FROM whatsapp_authorized_numbers WHERE id = $1 AND usuario_id = $2",
      [id, usuarioId]
    );
    if (!rowCount) return res.status(404).json({ error: "Numero nao encontrado." });
    res.json({ ok: true });
  } catch (err) {
    console.error("[whatsapp/authorized DELETE]:", err.message);
    res.status(500).json({ error: "Erro ao remover numero." });
  }
});

export default router;

