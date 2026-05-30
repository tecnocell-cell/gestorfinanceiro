/**
 * evolutionProvider.js — Cliente HTTP para WhatsApp (Evolution API ou WhatsApp-Gateway)
 *
 * Toda comunicação com o serviço externo passa por aqui.
 * Nenhum outro arquivo deve chamar fetch diretamente para esses endpoints.
 *
 * Variáveis de ambiente (nomes mantidos por compatibilidade):
 *   EVOLUTION_API_URL  — URL base (Evolution self-hosted OU WhatsApp-Gateway, ex: http://IP:8081)
 *   EVOLUTION_API_KEY  — API key (deve ser igual ao API_KEY do Gateway)
 *
 * Endpoints esperados (compatíveis Evolution / Gateway):
 *   POST   /instance/create
 *   GET    /instance/connect/:instanceName
 *   GET    /instance/fetchInstances
 *   DELETE /instance/logout/:instanceName
 *   DELETE /instance/delete/:instanceName
 *   GET    /media/:instanceName/:filename
 *
 * Autenticação: header `apikey: <EVOLUTION_API_KEY>`
 */

function base() {
  const url = process.env.EVOLUTION_API_URL;
  if (!url) throw new Error("EVOLUTION_API_URL não configurada.");
  return url.replace(/\/$/, "");
}

function key() {
  const k = process.env.EVOLUTION_API_KEY;
  if (!k) throw new Error("EVOLUTION_API_KEY não configurada.");
  return k;
}

/**
 * Executa uma chamada HTTP para o serviço WhatsApp (Evolution ou Gateway).
 *
 * @param {string} method      - GET | POST | DELETE
 * @param {string} path        - ex: "/instance/create"
 * @param {object} [body]      - payload JSON (omitir para GET)
 * @param {number} [timeoutMs] - timeout em ms (padrão: 15000)
 * @returns {Promise<any>} - JSON da resposta
 */
async function evoFetch(method, path, body, timeoutMs = 15_000) {
  const url = base() + path;
  const headers = {
    apikey: key(),
    "Content-Type": "application/json",
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const options = { method, headers, signal: controller.signal };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, options);
  } catch (networkErr) {
    if (networkErr.name === "AbortError") {
      throw new Error(
        `WhatsApp Gateway timeout após ${timeoutMs / 1000}s (${method} ${path}) — verifique se o Gateway está rodando em ${process.env.EVOLUTION_API_URL}`
      );
    }
    throw new Error(`WhatsApp API inacessível (${method} ${path}): ${networkErr.message}`);
  } finally {
    clearTimeout(timer);
  }

  let json;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg =
      json?.message ||
      json?.error ||
      (Array.isArray(json?.response?.message)
        ? json.response.message.join(", ")
        : null) ||
      `HTTP ${res.status}`;
    const err = new Error(`WhatsApp API erro (${method} ${path}): ${msg}`);
    err.status = res.status;
    err.evoResponse = json;
    throw err;
  }

  return json;
}

/**
 * Cria uma instância com webhook configurado.
 */
export async function createInstance({ instanceName, webhookUrl, webhookSecret }) {
  const webhook = {
    url: webhookUrl,
    byEvents: true,
    base64: true,
    events: ["QRCODE_UPDATED", "CONNECTION_UPDATE", "MESSAGES_UPSERT"],
  };

  if (webhookSecret) {
    webhook.headers = {
      "X-CenterFlow-Webhook-Secret": webhookSecret,
    };
  }

  return evoFetch("POST", "/instance/create", {
    instanceName,
    integration: "WHATSAPP-BAILEYS",
    qrcode: true,
    groupsIgnore: true,
    rejectCall: true,
    readMessages: false,
    alwaysOnline: false,
    webhook,
  });
}

/**
 * Solicita o QR code da instância (GET /instance/connect/:instanceName).
 */
export async function connectInstance(instanceName) {
  return fetchDirectConnectQr(instanceName);
}

export async function fetchDirectConnectQr(instanceName) {
  return evoFetch("GET", `/instance/connect/${instanceName}`);
}

function matchesInstanceName(item, instanceName) {
  const n =
    item?.instance?.instanceName ||
    item?.instanceName ||
    item?.name ||
    item?.instance?.name;
  return n === instanceName;
}

/**
 * Busca dados da instância (pode incluir QR em qrcode.base64 ou base64).
 */
export async function fetchInstanceByName(instanceName) {
  try {
    const filtered = await evoFetch(
      "GET",
      `/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`
    );
    if (Array.isArray(filtered)) return filtered;
    if (filtered && typeof filtered === "object") return [filtered];
    return [];
  } catch (err) {
    if (err.status !== 404) throw err;
  }

  const all = await evoFetch("GET", "/instance/fetchInstances");
  const list = Array.isArray(all) ? all : all ? [all] : [];
  return list.filter((item) => matchesInstanceName(item, instanceName));
}

export async function getConnectionState(instanceName) {
  return evoFetch("GET", `/instance/connectionState/${instanceName}`);
}

export async function logoutInstance(instanceName) {
  try {
    return await evoFetch("DELETE", `/instance/logout/${instanceName}`);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

export async function deleteInstance(instanceName) {
  try {
    return await evoFetch("DELETE", `/instance/delete/${instanceName}`);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

/**
 * Verifica se o Gateway está vivo.
 * Usa timeout curto (5s) — chamado em health checks frequentes.
 * Retorna { ok: true, sessions: N, ... } ou lança erro.
 */
export async function gatewayHealth() {
  return evoFetch("GET", "/health", undefined, 5_000);
}

/**
 * Envia mensagem de texto via Gateway.
 *
 * @param {string} instanceName  - nome da instância (ex: "cf-admin", "cf-{uuid}")
 * @param {string} number        - numero de telefone so digitos (ex: "559481406316")
 * @param {string} text          - texto a enviar
 * @returns {Promise<{status: string}>}
 */
export async function sendText(instanceName, number, text) {
  return evoFetch(
    "POST",
    `/message/sendText/${encodeURIComponent(instanceName)}`,
    { number: String(number), text: String(text) },
    10_000
  );
}

const SAFE_MEDIA_SEGMENT = /^[a-zA-Z0-9._-]+$/;

/**
 * Baixa arquivo de mídia do Gateway.
 *
 * @param {string} instanceName
 * @param {string} filename
 * @returns {Promise<Buffer>}
 */
export async function downloadMedia(instanceName, filename) {
  if (!SAFE_MEDIA_SEGMENT.test(instanceName) || !SAFE_MEDIA_SEGMENT.test(filename)) {
    throw new Error("Parâmetros de mídia inválidos");
  }

  const url =
    `${base()}/media/${encodeURIComponent(instanceName)}/${encodeURIComponent(filename)}`;
  const headers = { apikey: key(), "api-key": key() };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  let res;
  try {
    res = await fetch(url, { method: "GET", headers, signal: controller.signal });
  } catch (networkErr) {
    if (networkErr.name === "AbortError") {
      throw new Error(
        `Gateway media timeout após 30s (GET /media/${instanceName}/${filename})`
      );
    }
    throw new Error(
      `Gateway media inacessível (GET /media/${instanceName}/${filename}): ${networkErr.message}`
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `Gateway media HTTP ${res.status}${errText ? `: ${errText.slice(0, 200)}` : ""}`
    );
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (!buffer.length) {
    throw new Error(`Gateway media vazio (${instanceName}/${filename})`);
  }

  return buffer;
}
