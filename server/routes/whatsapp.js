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
  sendText,
} from "../whatsapp/evolutionProvider.js";
import { parseMessage } from "../whatsapp/messageParser.js";
import { processMediaInbox }         from "../whatsapp/mediaProcessor.js";
import {
  getAnyPending,
  createPending,
  updatePending,
  deletePending,
  getCategories,
  getAmbientesDoUsuario,
  confirmPendingLancamento,
  buildConfirmacaoMsg,
  buildCategoryListMsg,
  buildAmbienteSelectorMsg,
  buildAmbienteConfirmadoMsg,
  todayIso,
  MSG_CONFIRMADO,
  MSG_CANCELADO,
  MSG_EXPIRADO,
  MSG_ERRO_SALVAR,
  MSG_ERRO_PROCESSAR,
} from "../whatsapp/financePending.js";
import { detectQueryCommand, handleQueryCommand, MENU_TEXTO } from "../whatsapp/financeCommands.js";
import { detectBillingCommand, handleBillingCommand, handleBillingPendingFlow } from "../whatsapp/billingFlow.js";
import { handleLeadMessage } from "../whatsapp/leadFlow.js";
import { getUserSubscriptionResources } from "../billing/accessControl.js";
import {
  whatsappCapabilitiesFromRecursos,
  PUBLIC_MESSAGES,
} from "../billing/planRules.js";

const router = Router();

/**
 * Envia mensagem de texto para o usuário. Fire-and-forget.
 */
function sendReply(instanceName, number, text) {
  sendText(instanceName, number, text).catch((err) => {
    console.error(`[whatsapp/reply] erro para ${number}:`, err.message);
  });
}

/**
 * Processa mensagem recebida: detecta SIM/NAO ou tenta criar pré-lançamento.
 * Fire-and-forget — nunca bloqueia o webhook.
 *
 * Fluxo:
 *   SIM → confirmar pending → criar lançamento real no estado
 *   NAO → rejeitar pending
 *   msg com número → parsear → inserir pending → pedir confirmação
 *   msg sem número → orientar usuário
 *
 * @param {string} usuarioId
 * @param {string} fromNumber
 * @param {string} instanceName
 * @param {string} inboxId
 * @param {string} msgBody
 */
/**
 * Processa mensagem de mídia (áudio/imagem/vídeo/documento).
 *
 * Fluxo:
 *   1. Envia ACK imediato ao usuário
 *   2. Marca inbox response_sent=true (respondemos)
 *   3. Dispara mediaProcessor assíncrono (transcrição/OCR → parse → pending)
 *   4. mediaProcessor envia reply final com resultado ou fallback
 *
 * Fire-and-forget — nunca bloqueia o webhook.
 */
async function processMediaMessage(
  usuarioId, fromNumber, instanceName, inboxId,
  messageType, caption, mediaPath, mediaMimetype
) {
  const markInbox = (sent, error = null) =>
    query(
      "UPDATE whatsapp_inbox SET response_sent = $1, response_error = $2 WHERE id = $3",
      [sent, error, inboxId]
    ).catch(() => {});

  // ACK imediato
  let ack;
  if (messageType === "audio") {
    ack = "🎵 Recebi seu áudio. Transcrevendo...";
  } else if (messageType === "image") {
    ack = caption
      ? `🧾 Recebi seu comprovante com legenda: "${caption}". Analisando...`
      : "🧾 Recebi seu comprovante. Analisando...";
  } else if (messageType === "document") {
    ack = caption
      ? `📄 Recebi seu documento com legenda: "${caption}". Analisando...`
      : "📄 Recebi seu documento. Analisando...";
  } else {
    ack = "📎 Recebi seu arquivo. Analisando...";
  }

  sendReply(instanceName, fromNumber, ack);
  await markInbox(true);

  // Processar mídia de forma assíncrona (transcrição/OCR → parse → pending)
  processMediaInbox({
    usuarioId,
    fromNumber,
    instanceName,
    inboxId,
    messageType,
    mediaPath:     mediaPath     || null,
    mediaMimetype: mediaMimetype || null,
    caption:       caption       || null,
    sendReply: (text) => sendReply(instanceName, fromNumber, text),
  }).catch(e => console.error("[whatsapp/processMediaInbox]:", e.message));

  console.log(`[whatsapp/media] ack enviado: usuario=${usuarioId} tipo=${messageType} from=${fromNumber}`);
}

/**
 * Processa mensagem financeira recebida.
 *
 * Fluxo:
 *   1. Pendência ativa → tratar como resposta do fluxo (confirmar/categoria/cancelar)
 *   2. Comando de consulta → saldo, extrato, lançamentos, gastos
 *   3. Parse como novo lançamento → criar pendente e pedir confirmação
 *   4. Fallback → mensagem de ajuda
 *
 * Fire-and-forget — nunca bloqueia o webhook.
 */
async function processMessage(usuarioId, fromNumber, instanceName, inboxId, msgBody) {
  const body = String(msgBody || "").trim();

  const markInbox = (sent, error = null) =>
    query(
      "UPDATE whatsapp_inbox SET response_sent = $1, response_error = $2 WHERE id = $3",
      [sent, error, inboxId]
    ).catch(() => {});

  // ── 1. Verificar pendência (ativa ou expirada) ───────────────────────────
  const anyPending = await getAnyPending(usuarioId);

  if (anyPending) {
    if (new Date(anyPending.expires_at) < new Date()) {
      await deletePending(usuarioId);
      sendReply(instanceName, fromNumber, MSG_EXPIRADO);
      await markInbox(true);
      return;
    }

    // Billing flow tem seu próprio handler
    if (anyPending.payload?.action === "billing_payment") {
      await handleBillingPendingFlow(usuarioId, fromNumber, instanceName, { ...anyPending, body });
      await markInbox(true);
      return;
    }

    await handlePendingFlow(usuarioId, fromNumber, instanceName, anyPending, body);
    await markInbox(true);
    return;
  }

  // ── 2. Comando de cobrança/mensalidade ───────────────────────────────────
  if (detectBillingCommand(body)) {
    console.log(`[whatsapp/billing] cmd mensalidade: usuario=${usuarioId}`);
    await handleBillingCommand(usuarioId, fromNumber, instanceName);
    await markInbox(true);
    return;
  }

  // ── 3. Comando de consulta ────────────────────────────────────────────────
  const queryCmd = detectQueryCommand(body);
  if (queryCmd) {
    console.log(`[whatsapp/query] cmd=${queryCmd.cmd} usuario=${usuarioId}`);

    // ajuda não precisa de contexto de ambiente
    if (queryCmd.cmd === "ajuda") {
      sendReply(instanceName, fromNumber, MENU_TEXTO);
      await markInbox(true);
      return;
    }

    // Com múltiplos ambientes, perguntar qual antes de consultar
    const ambientes = await getAmbientesDoUsuario(usuarioId);
    if (ambientes.length > 1) {
      const payload = {
        action: "query_consulta",
        step: "escolher_ambiente_consulta",
        ambientes_opcoes: ambientes,
        queryCmd,
      };
      await createPending(usuarioId, fromNumber, payload);
      sendReply(instanceName, fromNumber, buildAmbienteSelectorMsg(ambientes));
      console.log(`[whatsapp/query] aguardando ambiente para consulta: usuario=${usuarioId} cmd=${queryCmd.cmd}`);
      await markInbox(true);
      return;
    }

    // Ambiente único: consulta direta pelo ID do único ambiente
    const ambienteId = ambientes[0]?.id || null;
    const resp = await handleQueryCommand(usuarioId, queryCmd, ambienteId);
    sendReply(instanceName, fromNumber, resp);
    await markInbox(true);
    return;
  }

  // ── 4. Parse como novo lançamento ────────────────────────────────────────
  const parsed = parseMessage(body);
  if (parsed) {
    try {
      await handleNewLancamento(usuarioId, fromNumber, instanceName, parsed);
    } catch (err) {
      console.error("[whatsapp/message] erro ao criar pending:", err.message);
      sendReply(instanceName, fromNumber, MSG_ERRO_PROCESSAR);
      await markInbox(false, err.message.slice(0, 500));
      return;
    }
    await markInbox(true);
    return;
  }

  // ── 5. Fallback — exibe menu de ajuda ────────────────────────────────────
  console.log(`[whatsapp/message] comando recebido sem match: usuario=${usuarioId} body=${body.slice(0, 80)}`);
  sendReply(instanceName, fromNumber, MENU_TEXTO);
  await markInbox(true);
}

/** Normaliza texto para comparação. */
function normStr(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/**
 * Trata resposta do usuário para uma pendência ativa.
 * step="confirmacao":    1=confirmar, 2=trocar categoria, 3=cancelar
 * step="aguardando_categoria": número = escolher categoria
 */
async function handlePendingFlow(usuarioId, fromNumber, instanceName, pending, body) {
  const payload = pending.payload;
  const t = normStr(body);

  // ── Seleção de ambiente para CONSULTA ────────────────────────────────────
  if (payload.step === "escolher_ambiente_consulta") {
    const opcoes = payload.ambientes_opcoes || [];
    const num = parseInt(t, 10);

    if (["cancelar", "cancel", "nao", "n", "não"].includes(t)) {
      await deletePending(usuarioId);
      sendReply(instanceName, fromNumber, MSG_CANCELADO);
      return;
    }

    if (!Number.isFinite(num) || num < 1 || num > opcoes.length) {
      sendReply(instanceName, fromNumber, buildAmbienteSelectorMsg(opcoes));
      return;
    }

    const ambienteEscolhido = opcoes[num - 1];
    await deletePending(usuarioId);

    const resp = await handleQueryCommand(usuarioId, payload.queryCmd, ambienteEscolhido.id);
    const icone = ambienteEscolhido.tipo === "pessoal" ? "🏠" : "🏢";
    sendReply(instanceName, fromNumber,
      `${icone} *${ambienteEscolhido.nome}*\n──────────────────────\n${resp}`
    );
    console.log(
      `[whatsapp/query] consulta executada: usuario=${usuarioId}` +
      ` cmd=${payload.queryCmd?.cmd} ambiente=${ambienteEscolhido.nome}`
    );
    return;
  }

  // ── Seleção de ambiente (multiambiente) ───────────────────────────────────
  if (payload.step === "escolher_ambiente") {
    const opcoes = payload.ambientes_opcoes || [];

    // Número válido tem prioridade sobre palavras-chave para não conflitar com índices
    const num = parseInt(t, 10);
    if (Number.isFinite(num) && num >= 1 && num <= opcoes.length) {
      // número válido — tratado abaixo
    } else if (["cancelar", "cancel", "nao", "n", "não"].includes(t)) {
      await deletePending(usuarioId);
      sendReply(instanceName, fromNumber, MSG_CANCELADO);
      return;
    } else if (!Number.isFinite(num) || num < 1 || num > opcoes.length) {
      sendReply(instanceName, fromNumber, buildAmbienteSelectorMsg(opcoes));
      return;
    }

    const ambienteEscolhido = opcoes[num - 1];
    const parsed = payload.parsed;
    const tipo = parsed.tipo === "Receita" ? "Entrada" : "Saida";
    const categorias = await getCategories(usuarioId, tipo);

    let catSugerida = null;
    let confidence = "baixa";
    if (parsed.categoria && categorias.length) {
      const hint = normStr(parsed.categoria);
      const match = categorias.find((c) => {
        const n = normStr(c.descricao);
        return n.includes(hint) || hint.includes(n);
      });
      if (match) { catSugerida = match; confidence = "media"; }
    }
    if (!catSugerida && categorias.length) {
      catSugerida = categorias[0];
      confidence = "baixa";
    }

    const newPayload = {
      action: "create_lancamento",
      step: "confirmacao",
      ambienteId: ambienteEscolhido.id,
      ambienteNome: ambienteEscolhido.nome,
      ambienteTipo: ambienteEscolhido.tipo,
      lancamento: {
        data: todayIso(),
        tipo,
        valor: parsed.valor,
        contaEntradaId: null,
        contaSaidaId: null,
        planoId: catSugerida?.id || null,
        categoriaNome: catSugerida?.descricao || "",
        historico: parsed.descricao,
        observacao: "Criado via WhatsApp",
        status: "pago",
        pago: true,
        exportado: false,
        consiliado: false,
      },
      categoria_confidence: confidence,
      categoria_sugerida: catSugerida
        ? { id: catSugerida.id, descricao: catSugerida.descricao }
        : { id: "", descricao: "" },
      categoria_opcoes: [],
    };
    await updatePending(pending.id, newPayload);
    sendReply(instanceName, fromNumber, buildConfirmacaoMsg(newPayload));
    console.log(
      `[whatsapp/pending] ambiente escolhido: usuario=${usuarioId}` +
      ` ambiente=${ambienteEscolhido.nome} tipo=${tipo} valor=${parsed.valor}`
    );
    return;
  }

  if (payload.step === "confirmacao") {
    // Confirmar
    if (["1", "confirmar", "sim", "s", "ok", "pode"].includes(t)) {
      try {
        const lancamento = await confirmPendingLancamento(usuarioId, pending);
        const msgConfirmado = payload.ambienteNome
          ? buildAmbienteConfirmadoMsg(payload.ambienteNome, payload.ambienteTipo)
          : MSG_CONFIRMADO;
        sendReply(instanceName, fromNumber, msgConfirmado);
        console.log(
          `[whatsapp/pending] confirmado: usuario=${usuarioId}` +
          ` valor=${lancamento.valor} tipo=${lancamento.tipo}` +
          (payload.ambienteNome ? ` ambiente=${payload.ambienteNome}` : "")
        );
      } catch (err) {
        console.error("[whatsapp/pending] erro ao confirmar:", err.message);
        sendReply(instanceName, fromNumber, MSG_ERRO_SALVAR);
      }
      return;
    }

    // Trocar categoria
    if (["2", "trocar", "trocar categoria", "categoria"].includes(t)) {
      const categorias = await getCategories(usuarioId, payload.lancamento?.tipo);
      if (!categorias.length) {
        sendReply(instanceName, fromNumber,
          "Nenhuma categoria encontrada.\n\n" +
          buildConfirmacaoMsg(payload)
        );
        return;
      }
      const newPayload = {
        ...payload,
        step: "aguardando_categoria",
        categoria_opcoes: categorias.slice(0, 20),
      };
      await updatePending(pending.id, newPayload);
      sendReply(instanceName, fromNumber, buildCategoryListMsg(categorias));
      console.log(`[whatsapp/pending] aguardando categoria: usuario=${usuarioId}`);
      return;
    }

    // Cancelar
    if (["3", "cancelar", "cancel", "nao", "n", "não"].includes(t)) {
      await deletePending(usuarioId);
      sendReply(instanceName, fromNumber, MSG_CANCELADO);
      return;
    }

    // Resposta não reconhecida — reapresenta confirmação
    sendReply(instanceName, fromNumber, buildConfirmacaoMsg(payload));
    return;
  }

  if (payload.step === "aguardando_categoria") {
    const opcoes = payload.categoria_opcoes || [];

    // Números são sempre índice de categoria — checar ANTES do cancelar
    const num = parseInt(t, 10);
    if (Number.isFinite(num) && num >= 1 && num <= opcoes.length) {
      const escolhida = opcoes[num - 1];
      const newPayload = {
        ...payload,
        step: "confirmacao",
        lancamento: {
          ...payload.lancamento,
          planoId: escolhida.id,
          categoriaNome: escolhida.descricao,
        },
        categoria_sugerida: { id: escolhida.id, descricao: escolhida.descricao },
      };
      await updatePending(pending.id, newPayload);
      sendReply(instanceName, fromNumber,
        `Categoria alterada para *${escolhida.descricao}*.\n\n` +
        buildConfirmacaoMsg(newPayload)
      );
      console.log(
        `[whatsapp/pending] categoria alterada: usuario=${usuarioId} cat=${escolhida.descricao}`
      );
      return;
    }

    // Palavras de cancelamento (sem números — para não conflitar com índices)
    if (["cancelar", "cancel", "nao", "n", "não"].includes(t)) {
      await deletePending(usuarioId);
      sendReply(instanceName, fromNumber, MSG_CANCELADO);
      return;
    }

    // Entrada inválida — reapresenta lista
    sendReply(instanceName, fromNumber, buildCategoryListMsg(opcoes));
    return;
  }
}

/**
 * Cria um novo pending a partir de uma mensagem parseada.
 * Busca a melhor categoria no planoContas real do tenant.
 */
async function handleNewLancamento(usuarioId, fromNumber, instanceName, parsed) {
  // Multiambiente: se o usuário tem mais de 1 ambiente, perguntar em qual registrar
  const ambientes = await getAmbientesDoUsuario(usuarioId);
  if (ambientes.length > 1) {
    const payload = {
      action: "create_lancamento",
      step: "escolher_ambiente",
      ambientes_opcoes: ambientes,
      parsed,
    };
    await createPending(usuarioId, fromNumber, payload);
    sendReply(instanceName, fromNumber, buildAmbienteSelectorMsg(ambientes));
    console.log(
      `[whatsapp/pending] aguardando seleção de ambiente: usuario=${usuarioId}` +
      ` ambientes=${ambientes.length}`
    );
    return;
  }

  const tipo = parsed.tipo === "Receita" ? "Entrada" : "Saida";
  const categorias = await getCategories(usuarioId, tipo);

  let catSugerida = null;
  let confidence = "baixa";

  if (parsed.categoria && categorias.length) {
    const hint = normStr(parsed.categoria);
    const match = categorias.find((c) => {
      const n = normStr(c.descricao);
      return n.includes(hint) || hint.includes(n);
    });
    if (match) {
      catSugerida = match;
      confidence = "media";
    }
  }

  // Fallback: primeira categoria compatível
  if (!catSugerida && categorias.length) {
    catSugerida = categorias[0];
    confidence = "baixa";
  }

  const ambienteUnico = ambientes[0] ?? null;
  const payload = {
    action: "create_lancamento",
    step: "confirmacao",
    ...(ambienteUnico
      ? { ambienteId: ambienteUnico.id, ambienteNome: ambienteUnico.nome, ambienteTipo: ambienteUnico.tipo }
      : {}),
    lancamento: {
      data: todayIso(),
      tipo,
      valor: parsed.valor,
      contaEntradaId: null,
      contaSaidaId: null,
      planoId: catSugerida?.id || null,
      categoriaNome: catSugerida?.descricao || "",
      historico: parsed.descricao,
      observacao: "Criado via WhatsApp",
      status: "pago",
      pago: true,
      exportado: false,
      consiliado: false,
    },
    categoria_confidence: confidence,
    categoria_sugerida: catSugerida
      ? { id: catSugerida.id, descricao: catSugerida.descricao }
      : { id: "", descricao: "" },
    categoria_opcoes: [],
  };

  await createPending(usuarioId, fromNumber, payload);
  sendReply(instanceName, fromNumber, buildConfirmacaoMsg(payload));
  console.log(
    `[whatsapp/pending] criado: usuario=${usuarioId}` +
    ` tipo=${tipo} valor=${parsed.valor}` +
    ` cat=${catSugerida?.descricao || "nenhuma"} confidence=${confidence}`
  );
}

/** Cooldowns — chamadas repetidas a /instance/connect derrubam a sessão na Evolution v2.1.1 */
const evoFetchListCooldown = new Map();
const evo404Warned = new Set();
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
      const fromNumber   = data?.fromNumber || data?.from || req.body?.fromNumber || null;
      const msgBody      = data?.body       || data?.text || req.body?.body       || "";
      const messageType  = data?.messageType || "text";
      const mediaInfo    = data?.media       || null;
      // caption: da mídia ou do body (imagens/vídeos já trazem caption no body)
      const captionText  = mediaInfo?.caption || null;
      const isMedia      = messageType !== "text";

      if (isAdminInstance) {
        // ── Modo PF: allowlist obrigatoria ──────────────────────────────
        const authRow = await lookupAuthorizedPhone(fromNumber);
        if (!authRow) {
          console.log(
            `[whatsapp/webhook] MESSAGES_UPSERT PF -- numero nao autorizado, fluxo comercial: ${fromNumber || "?"}`
          );
          if (fromNumber && (msgBody || "").trim()) {
            handleLeadMessage(instanceName, fromNumber, msgBody).catch(
              (e) => console.error("[whatsapp/leadFlow]:", e.message)
            );
          }
          return;
        }
        query(
          "UPDATE whatsapp_authorized_numbers SET last_used_at = NOW() WHERE id = $1",
          [authRow.id]
        ).catch(() => {});
        console.log(
          `[whatsapp/webhook] MESSAGES_UPSERT PF usuario=${authRow.usuario_id}` +
          ` from=${fromNumber} type=${messageType} body=${String(msgBody).slice(0, 120)}`
        );
        // Salvar na inbox (texto ou mídia) e processar
        if (msgBody || isMedia) {
          query(
            `INSERT INTO whatsapp_inbox
               (usuario_id, from_number, instance_name, message_text,
                message_type, media_mimetype, media_filename, media_path, caption)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id`,
            [
              authRow.usuario_id, fromNumber, instanceName,
              String(msgBody || captionText || "").trim(),
              messageType,
              mediaInfo?.mimetype   || null,
              mediaInfo?.filename   || null,
              mediaInfo?.localPath  || null,
              captionText,
            ]
          )
            .then(({ rows }) => {
              if (!rows[0]?.id) return;
              const inboxId = rows[0].id;
              if (isMedia) {
                processMediaMessage(authRow.usuario_id, fromNumber, instanceName, inboxId, messageType, captionText, mediaInfo?.localPath, mediaInfo?.mimetype)
                  .catch(e => console.error("[whatsapp/processMedia] PF:", e.message));
              } else {
                processMessage(authRow.usuario_id, fromNumber, instanceName, inboxId, msgBody)
                  .catch(e => console.error("[whatsapp/processMessage] PF:", e.message));
              }
            })
            .catch(e => console.error("[whatsapp/webhook] inbox PF insert:", e.message));
        }

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
          ` usuario=${sess.usuario_id} from=${fromNumber || "?"} type=${messageType} body=${String(msgBody).slice(0, 120)}`
        );
        // Salvar na inbox (texto ou mídia) e processar
        if (msgBody || isMedia) {
          query(
            `INSERT INTO whatsapp_inbox
               (usuario_id, from_number, instance_name, message_text,
                message_type, media_mimetype, media_filename, media_path, caption)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id`,
            [
              sess.usuario_id, fromNumber || "", instanceName,
              String(msgBody || captionText || "").trim(),
              messageType,
              mediaInfo?.mimetype   || null,
              mediaInfo?.filename   || null,
              mediaInfo?.localPath  || null,
              captionText,
            ]
          )
            .then(({ rows }) => {
              if (!rows[0]?.id || !fromNumber) return;
              const inboxId = rows[0].id;
              if (isMedia) {
                processMediaMessage(sess.usuario_id, fromNumber, instanceName, inboxId, messageType, captionText, mediaInfo?.localPath, mediaInfo?.mimetype)
                  .catch(e => console.error("[whatsapp/processMedia] PJ:", e.message));
              } else {
                processMessage(sess.usuario_id, fromNumber, instanceName, inboxId, msgBody)
                  .catch(e => console.error("[whatsapp/processMessage] PJ:", e.message));
              }
            })
            .catch(e => console.error("[whatsapp/webhook] inbox PJ insert:", e.message));
        }
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
 * Gera variantes de um numero BR para lidar com o digito 9 apos o DDD.
 * Retorna lista unica com o original mais variante(s).
 *
 * Regras (apenas para numeros que comecam com DDI 55):
 *   55 + DDD(2) + 9 + 8 digitos = 13 digitos → variante sem o 9: 55+DDD+8dig = 12 digitos
 *   55 + DDD(2) + 8 digitos     = 12 digitos → variante com o 9: 55+DDD+9+8dig = 13 digitos
 *
 * Numeros internacionais (sem 55) sao retornados como lista de um elemento.
 *
 * @param {string} digits  - apenas digitos (saida de digitsOnly)
 * @returns {string[]}     - lista unica de variantes
 */
function phoneVariantsBR(digits) {
  if (!digits) return [];
  const variants = new Set([digits]);

  if (digits.startsWith("55") && digits.length >= 12) {
    const withoutDdi = digits.slice(2); // remove "55"
    // withoutDdi: DDD(2) + numero
    const ddd = withoutDdi.slice(0, 2);
    const num = withoutDdi.slice(2);

    if (num.length === 9 && num.startsWith("9")) {
      // 55 + DDD + 9XXXXXXXX → variante sem o 9: 55 + DDD + XXXXXXXX
      variants.add("55" + ddd + num.slice(1));
    } else if (num.length === 8) {
      // 55 + DDD + XXXXXXXX → variante com 9: 55 + DDD + 9XXXXXXXX
      variants.add("55" + ddd + "9" + num);
    }
  }

  return [...variants];
}

/**
 * Busca entrada ativa na allowlist pelo numero de telefone.
 * Compara contra todas as variantes BR (com/sem o 9 pos-DDD).
 * @param {string} fromNumber
 * @returns {object|null} linha de whatsapp_authorized_numbers ou null
 */
async function lookupAuthorizedPhone(fromNumber) {
  if (!fromNumber) return null;
  const digits = digitsOnly(fromNumber);
  if (!digits) return null;

  const variants = phoneVariantsBR(digits);

  const { rows } = await query(
    `SELECT id, usuario_id, phone_number, label
       FROM whatsapp_authorized_numbers
      WHERE phone_number = ANY($1) AND active = true
      LIMIT 1`,
    [variants]
  );
  return rows[0] || null;
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
  if (!fromNumber) return false;
  const digits = digitsOnly(fromNumber);
  if (!digits) return false;

  const variants = phoneVariantsBR(digits);

  // Verificar allowlist do tenant
  const { rows: allowList } = await query(
    "SELECT phone_number FROM whatsapp_authorized_numbers WHERE usuario_id = $1",
    [usuarioId]
  );

  if (allowList.length === 0) {
    // Sem allowlist: aceitar apenas o dono da sessao (com variantes BR)
    const { rows: sess } = await query(
      "SELECT phone_number FROM whatsapp_sessions WHERE usuario_id = $1 LIMIT 1",
      [usuarioId]
    );
    if (!sess.length || !sess[0].phone_number) return false;
    const sessVariants = phoneVariantsBR(digitsOnly(sess[0].phone_number));
    return variants.some(v => sessVariants.includes(v));
  }

  // Com allowlist: verificar active = true
  const { rows: active } = await query(
    `SELECT id FROM whatsapp_authorized_numbers
      WHERE usuario_id = $1 AND active = true
        AND phone_number = ANY($2)
      LIMIT 1`,
    [usuarioId, variants]
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
      `SELECT id, phone_number, label, active, is_primary, verified_at, last_used_at, created_at
         FROM whatsapp_authorized_numbers
        WHERE usuario_id = $1
        ORDER BY is_primary DESC, created_at ASC`,
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

// ── Planos e capacidades (assinatura comercial — Etapa 7.0) ─────────────────

/**
 * Capacidades WhatsApp a partir da assinatura ativa (planRules).
 */
async function getUserPlanInfo(usuarioId) {
  const bundle = await getUserSubscriptionResources(usuarioId);
  const caps = whatsappCapabilitiesFromRecursos(bundle.recursos);

  const { rows: countRows } = await query(
    "SELECT COUNT(*)::int AS total FROM whatsapp_authorized_numbers WHERE usuario_id = $1",
    [usuarioId]
  );
  const used_authorized_numbers = countRows[0]?.total || 0;

  return {
    plan: bundle.plano_slug,
    plano_nome: bundle.plano_nome,
    max_users: bundle.recursos?.limiteUsuarios ?? 1,
    max_authorized_numbers: caps.max_authorized_numbers,
    used_authorized_numbers,
    ai_text_enabled: caps.ai_text_enabled,
    ai_audio_enabled: caps.ai_audio_enabled,
    ai_receipt_enabled: caps.ai_receipt_enabled,
  };
}

// GET /api/whatsapp/plan-limit
// Retorna capacidades completas do plano do usuário autenticado.
router.get("/plan-limit", ...auth, async (req, res) => {
  try {
    const info = await getUserPlanInfo(req.user.id);
    res.json(info);
  } catch (err) {
    console.error("[whatsapp/plan-limit GET]:", err.message);
    res.status(500).json({ error: "Erro ao consultar limite de plano." });
  }
});

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
    // Verificar conflito com outro usuário — número ativo em outra conta
    const phoneVariants = phoneVariantsBR(phone);
    const { rows: conflict } = await query(
      `SELECT usuario_id FROM whatsapp_authorized_numbers
        WHERE phone_number = ANY($1) AND active = true AND usuario_id != $2
        LIMIT 1`,
      [phoneVariants, usuarioId]
    );
    if (conflict.length) {
      return res.status(409).json({
        error: "Este número já está autorizado em outra conta. Remova da conta anterior antes de vincular novamente.",
        code: "PHONE_CONFLICT",
      });
    }

    // Verificar limite de plano
    const planInfo = await getUserPlanInfo(usuarioId);
    const { plan, max_authorized_numbers, used_authorized_numbers } = planInfo;
    if (used_authorized_numbers >= max_authorized_numbers) {
      return res.status(403).json({
        error: PUBLIC_MESSAGES.whatsappLimit,
        code: 'PLAN_LIMIT',
        plan,
        limit: max_authorized_numbers,
        used: used_authorized_numbers,
      });
    }

    const isFirst = used_authorized_numbers === 0;
    const { rows } = await query(
      `INSERT INTO whatsapp_authorized_numbers (usuario_id, phone_number, label, is_primary)
       VALUES ($1, $2, $3, $4)
       RETURNING id, phone_number, label, active, is_primary, verified_at, last_used_at, created_at`,
      [usuarioId, phone, String(label).trim(), isFirst]
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
  const { active, label, is_primary } = req.body || {};
  const usuarioId = req.user.id;

  const sets = [];
  const vals = [];
  let i = 1;

  if (active !== undefined) { sets.push(`active = $${i++}`); vals.push(!!active); }
  if (label  !== undefined) { sets.push(`label  = $${i++}`); vals.push(String(label).trim()); }

  if (!sets.length && is_primary === undefined) {
    return res.status(400).json({ error: "Nenhum campo para atualizar." });
  }

  try {
    if (is_primary === true) {
      await query(
        `UPDATE whatsapp_authorized_numbers SET is_primary = false WHERE usuario_id = $1`,
        [usuarioId]
      );
      sets.push(`is_primary = $${i++}`);
      vals.push(true);
    }

    if (!sets.length) return res.status(400).json({ error: "Nenhum campo para atualizar." });

    vals.push(id, usuarioId);
    const { rows } = await query(
      `UPDATE whatsapp_authorized_numbers
          SET ${sets.join(", ")}, updated_at = NOW()
        WHERE id = $${i} AND usuario_id = $${i + 1}
        RETURNING id, phone_number, label, active, is_primary, verified_at, last_used_at, created_at`,
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

// GET /api/whatsapp/inbox
// Retorna as ultimas mensagens brutas recebidas do usuario autenticado.
// Query param: ?limit=50&offset=0&status=pending
router.get("/inbox", ...auth, async (req, res) => {
  const usuarioId = req.user.id;
  const limit  = Math.min(parseInt(req.query.limit  || "50",  10), 200);
  const offset = Math.max(parseInt(req.query.offset || "0",   10), 0);
  const status = req.query.status; // opcional: pending | processed | ignored

  try {
    const conditions = ["usuario_id = $1"];
    const filterVals = [usuarioId];
    let i = 2;

    if (status && ["pending", "processed", "ignored"].includes(status)) {
      conditions.push(`status = $${i++}`);
      filterVals.push(status);
    }

    const limitIdx = i;
    const offsetIdx = i + 1;
    const listVals = [...filterVals, limit, offset];

    const { rows } = await query(
      `SELECT id, from_number, instance_name, message_text, status, created_at
         FROM whatsapp_inbox
        WHERE ${conditions.join(" AND ")}
        ORDER BY created_at DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      listVals
    );

    const { rows: countRows } = await query(
      `SELECT COUNT(*)::int AS total FROM whatsapp_inbox WHERE ${conditions.join(" AND ")}`,
      filterVals
    );

    res.json({ inbox: rows, total: countRows[0]?.total || 0 });
  } catch (err) {
    console.error("[whatsapp/inbox GET]:", err.message);
    res.status(500).json({ error: "Erro ao buscar inbox." });
  }
});

// GET /api/whatsapp/pending
// Retorna pré-lançamentos do usuário autenticado.
// Query params: ?limit=20&offset=0&status=pending_confirmation|confirmed|rejected
router.get("/pending", ...auth, async (req, res) => {
  const usuarioId = req.user.id;
  const limit  = Math.min(parseInt(req.query.limit  || "20",  10), 100);
  const offset = Math.max(parseInt(req.query.offset || "0",   10), 0);
  const status = req.query.status;

  try {
    const conditions = ["usuario_id = $1"];
    const vals = [usuarioId];
    let i = 2;

    if (status && ["pending_confirmation", "confirmed", "rejected"].includes(status)) {
      conditions.push(`status = $${i++}`);
      vals.push(status);
    }

    const listVals = [...vals, limit, offset];
    const { rows } = await query(
      `SELECT id, inbox_id, from_number, instance_name,
              tipo, valor, descricao, status, created_at, updated_at
         FROM whatsapp_pending_transactions
        WHERE ${conditions.join(" AND ")}
        ORDER BY created_at DESC
        LIMIT $${i} OFFSET $${i + 1}`,
      listVals
    );

    const { rows: countRows } = await query(
      `SELECT COUNT(*)::int AS total
         FROM whatsapp_pending_transactions
        WHERE ${conditions.join(" AND ")}`,
      vals
    );

    res.json({ pending: rows, total: countRows[0]?.total || 0 });
  } catch (err) {
    console.error("[whatsapp/pending GET]:", err.message);
    res.status(500).json({ error: "Erro ao buscar pré-lançamentos." });
  }
});

export default router;
