/**
 * evolutionProvider.js — Camada de isolamento para a Evolution API v2
 *
 * Toda comunicação HTTP com a Evolution API passa por aqui.
 * Nenhum outro arquivo deve importar fetch/axios para chamar a Evolution.
 *
 * Variáveis de ambiente necessárias (ver .env.example):
 *   EVOLUTION_API_URL  — URL base da instância self-hosted (ex: https://evo.exemplo.com)
 *   EVOLUTION_API_KEY  — Global API Key da Evolution API
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
 * Executa uma chamada HTTP para a Evolution API.
 * Lança um Error com message legível se a resposta não for 2xx.
 *
 * @param {string} method  - GET | POST | DELETE
 * @param {string} path    - ex: "/instance/create"
 * @param {object} [body]  - payload JSON (omitir para GET)
 * @returns {Promise<any>} - JSON da resposta
 */
async function evoFetch(method, path, body) {
  const url = base() + path;
  const headers = {
    apikey: key(),
    "Content-Type": "application/json",
  };

  const options = { method, headers };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, options);
  } catch (networkErr) {
    throw new Error(`Evolution API inacessível (${method} ${path}): ${networkErr.message}`);
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
    const err = new Error(`Evolution API erro (${method} ${path}): ${msg}`);
    err.status = res.status;
    err.evoResponse = json;
    throw err;
  }

  return json;
}

// ─── Exports públicos ──────────────────────────────────────────────────────────

/**
 * Cria uma instância na Evolution API com webhook configurado.
 *
 * @param {object} params
 * @param {string} params.instanceName  - nome único da instância (ex: cf-{uuid})
 * @param {string} params.webhookUrl    - URL completa do webhook incluindo ?secret=...
 */
export async function createInstance({ instanceName, webhookUrl }) {
  return evoFetch("POST", "/instance/create", {
    instanceName,
    integration: "WHATSAPP-BAILEYS",
    qrcode: true,
    groupsIgnore: true,
    rejectCall: true,
    readMessages: false,
    alwaysOnline: false,
    webhook: {
      url: webhookUrl,
      byEvents: false,
      base64: true,
      events: ["QRCODE_UPDATED", "CONNECTION_UPDATE"],
    },
  });
}

/**
 * Solicita o QR code da instância (pode retornar string raw, não PNG).
 *
 * @param {string} instanceName
 */
export async function connectInstance(instanceName) {
  return fetchDirectConnectQr(instanceName);
}

/**
 * GET /instance/connect/{instanceName} — endpoint direto de QR (Evolution v2.1.1).
 * Pode retornar code, base64, qrcode ou campos em data.*.
 *
 * @param {string} instanceName
 */
export async function fetchDirectConnectQr(instanceName) {
  return evoFetch("GET", `/instance/connect/${instanceName}`);
}

/**
 * Retorna o estado atual da conexão da instância.
 * Resposta esperada: { instance: { state: "open"|"connecting"|"close" } }
 *
 * @param {string} instanceName
 */
export async function getConnectionState(instanceName) {
  return evoFetch("GET", `/instance/connectionState/${instanceName}`);
}

/**
 * Desloga a instância do WhatsApp (mantém a instância na Evolution, mas desconecta).
 * Ignora erros 404 (instância já inexistente).
 *
 * @param {string} instanceName
 */
export async function logoutInstance(instanceName) {
  try {
    return await evoFetch("DELETE", `/instance/logout/${instanceName}`);
  } catch (err) {
    if (err.status === 404) return null; // já desconectada/inexistente — ok
    throw err;
  }
}

/**
 * Deleta a instância da Evolution API completamente.
 * Ignora erros 404 (instância já inexistente).
 *
 * @param {string} instanceName
 */
export async function deleteInstance(instanceName) {
  try {
    return await evoFetch("DELETE", `/instance/delete/${instanceName}`);
  } catch (err) {
    if (err.status === 404) return null; // já deletada — ok
    throw err;
  }
}
