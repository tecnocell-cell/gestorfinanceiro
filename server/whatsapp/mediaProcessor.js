/**
 * mediaProcessor.js
 *
 * Orquestra o processamento de mídia WhatsApp:
 *   áudio     → transcrição (Whisper) → parseMessage → pending_transaction
 *   imagem    → OCR (Vision)          → parseMessage → pending_transaction
 *   documento → OCR (Vision)          → parseMessage → pending_transaction
 *
 * Baixa mídia do Gateway via HTTP (GET /media/:instanceName/:filename).
 * Fallback local opcional apenas em dev (NODE_ENV=development ou MEDIA_LOCAL_FALLBACK=true).
 *
 * Exporta:
 *   processMediaInbox(params) → Promise<void>
 */

import path from "path";
import fs   from "fs";
import os   from "os";
import crypto from "crypto";
import { query }                    from "../db.js";
import { downloadMedia }            from "./evolutionProvider.js";
import { transcribeAudio }          from "./transcriptionProvider.js";
import { extractImageText }         from "./ocrProvider.js";
import { parseMessage }             from "./messageParser.js";
import {
  createPending as fpCreatePending,
  getCategories,
  getAmbientesDoUsuario,
  buildConfirmacaoMsg,
  buildAmbienteSelectorMsg,
  todayIso,
} from "./financePending.js";
import { getUserSubscriptionResources } from "../billing/accessControl.js";
import { whatsappCapabilitiesFromRecursos } from "../billing/planRules.js";

const GATEWAY_SESSIONS_DIR =
  process.env.GATEWAY_SESSIONS_DIR ||
  process.env.SESSIONS_DIR ||
  path.join(process.cwd(), "sessions");

/** Capacidades WhatsApp a partir da assinatura comercial (planRules), não whatsapp_user_plan legado. */
async function getUserPlanCaps(usuarioId) {
  try {
    const bundle = await getUserSubscriptionResources(usuarioId);
    return whatsappCapabilitiesFromRecursos(bundle.recursos);
  } catch (err) {
    console.warn("[mediaProcessor] getUserPlanCaps erro:", err.message);
    return {
      max_authorized_numbers: 1,
      ai_text_enabled: true,
      ai_audio_enabled: false,
      ai_receipt_enabled: false,
    };
  }
}

const SAFE_SEGMENT = /^[a-zA-Z0-9._-]+$/;

const useLocalFallback =
  process.env.NODE_ENV === "development" ||
  process.env.MEDIA_LOCAL_FALLBACK === "true";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Atualiza campos de processamento na inbox. */
async function updateInbox(inboxId, fields) {
  const sets = Object.entries(fields).map(([k], i) => `${k} = $${i + 2}`);
  const vals = [inboxId, ...Object.values(fields)];
  await query(
    `UPDATE whatsapp_inbox SET ${sets.join(", ")} WHERE id = $1`,
    vals
  ).catch(e => console.error("[mediaProcessor] updateInbox erro:", e.message));
}

/** Normaliza texto para comparação de categoria. */
function normStr(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/**
 * Extrai instanceName e filename de media.localPath de forma segura.
 * Valida que instanceName bate com o esperado (anti cross-tenant).
 *
 * @param {string|null} localPath
 * @param {string} expectedInstanceName
 * @returns {{ instanceName: string, filename: string } | null}
 */
export function parseMediaLocalPath(localPath, expectedInstanceName) {
  if (!localPath || typeof localPath !== "string") return null;

  let normalized = localPath.replace(/\\/g, "/").trim();
  if (!normalized || normalized.includes("\0") || normalized.includes("..")) return null;

  normalized = normalized.replace(/^\/+/, "");
  const parts = normalized.split("/").filter(Boolean);
  if (!parts.length) return null;

  for (const segment of parts) {
    if (!SAFE_SEGMENT.test(segment)) return null;
  }

  const filename = parts[parts.length - 1];
  let instanceName = expectedInstanceName;

  const cfSegments = parts.filter(p => p.startsWith("cf-"));
  if (cfSegments.length) {
    instanceName = cfSegments[cfSegments.length - 1];
  } else if (parts.length >= 2) {
    instanceName = parts[parts.length - 2];
  }

  if (!SAFE_SEGMENT.test(instanceName) || !SAFE_SEGMENT.test(filename)) return null;
  if (expectedInstanceName && instanceName !== expectedInstanceName) return null;

  return { instanceName, filename };
}

/** Grava buffer em arquivo temporário para os providers. */
function writeTempFile(buffer, filename) {
  const ext = path.extname(filename) || ".bin";
  const tmpPath = path.join(
    os.tmpdir(),
    `cf-media-${crypto.randomBytes(8).toString("hex")}${ext}`
  );
  fs.writeFileSync(tmpPath, buffer);
  return tmpPath;
}

function cleanupTemp(tmpPath, isTemp) {
  if (!isTemp || !tmpPath) return;
  try {
    fs.unlinkSync(tmpPath);
  } catch {
    // melhor esforço
  }
}

function resolveLocalPath(mediaPath) {
  return path.isAbsolute(mediaPath)
    ? mediaPath
    : path.join(GATEWAY_SESSIONS_DIR, mediaPath);
}

/**
 * Obtém arquivo de mídia: Gateway HTTP (produção) ou fallback local (dev).
 *
 * @returns {Promise<{ path: string, isTemp: boolean, error?: undefined } | { error: string }>}
 */
async function obtainMediaFile(instanceName, mediaPath) {
  const parsed = parseMediaLocalPath(mediaPath, instanceName);
  if (!parsed) {
    return { error: "Caminho de mídia inválido ou inseguro" };
  }

  const { instanceName: inst, filename } = parsed;
  const hasGateway = !!(
    process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY
  );

  if (hasGateway) {
    try {
      const buffer = await downloadMedia(inst, filename);
      return { path: writeTempFile(buffer, filename), isTemp: true };
    } catch (err) {
      if (!useLocalFallback) {
        return {
          error: `Falha ao baixar mídia do Gateway (${inst}/${filename}): ${err.message}`,
        };
      }
      console.warn(
        "[mediaProcessor] Gateway download falhou, tentando fallback local:",
        err.message
      );
    }
  } else if (!useLocalFallback) {
    return { error: "EVOLUTION_API_URL/EVOLUTION_API_KEY não configuradas" };
  }

  if (useLocalFallback) {
    const localPath = resolveLocalPath(mediaPath);
    if (fs.existsSync(localPath)) {
      return { path: localPath, isTemp: false };
    }
    return { error: `Arquivo local não encontrado: ${localPath}` };
  }

  return { error: "Não foi possível obter o arquivo de mídia" };
}

function downloadFailureReply(messageType) {
  if (messageType === "audio") {
    return "🎵 Recebi seu áudio, mas não consegui baixar o arquivo. Tente enviar novamente ou mande um texto: paguei 50 gasolina";
  }
  return "🧾 Recebi o comprovante, mas não consegui baixar o arquivo. Tente enviar novamente ou mande um texto: paguei 50 gasolina";
}

// ── Processador principal ─────────────────────────────────────────────────────

/**
 * Processa uma mensagem de mídia da inbox.
 *
 * @param {{
 *   usuarioId:    string,
 *   fromNumber:   string,
 *   instanceName: string,
 *   inboxId:      string,
 *   messageType:  "audio"|"image"|"document"|"video",
 *   mediaPath:    string|null,  -- media.localPath do webhook
 *   mediaMimetype:string|null,
 *   caption:      string|null,
 *   sendReply:    (text: string) => void,
 * }} params
 */
export async function processMediaInbox({
  usuarioId,
  fromNumber,
  instanceName,
  inboxId,
  messageType,
  mediaPath,
  mediaMimetype,
  caption,
  sendReply,
}) {
  await updateInbox(inboxId, { processing_status: "processing" });

  // ── Verificar capacidades do plano ──────────────────────────────────────
  const caps = await getUserPlanCaps(usuarioId);

  if (messageType === "audio" && !caps.ai_audio_enabled) {
    await updateInbox(inboxId, {
      processing_status: "done",
      processing_error:  "ai_audio_enabled=false para este plano",
    });
    sendReply(
      "🔒 Seu plano atual não inclui lançamentos por áudio.\n" +
      "Faça upgrade para usar este recurso.\n" +
      "Por enquanto, envie um texto: paguei 50 gasolina"
    );
    console.log(`[mediaProcessor] gating: áudio bloqueado para usuario=${usuarioId}`);
    return;
  }

  if ((messageType === "image" || messageType === "document") && !caps.ai_receipt_enabled) {
    await updateInbox(inboxId, {
      processing_status: "done",
      processing_error:  "ai_receipt_enabled=false para este plano",
    });
    sendReply(
      "🔒 Seu plano atual não inclui leitura de comprovantes.\n" +
      "Faça upgrade para usar este recurso.\n" +
      "Por enquanto, envie um texto: paguei 50 gasolina"
    );
    console.log(`[mediaProcessor] gating: comprovante bloqueado para usuario=${usuarioId}`);
    return;
  }

  let mediaFile = null;
  let isTemp = false;

  if (messageType !== "video" && mediaPath) {
    const obtained = await obtainMediaFile(instanceName, mediaPath);
    if (obtained.error) {
      await updateInbox(inboxId, {
        processing_status: "error",
        processing_error:  obtained.error,
      });
      sendReply(downloadFailureReply(messageType));
      console.warn(`[mediaProcessor] download falhou: inbox=${inboxId} ${obtained.error}`);
      return;
    }
    mediaFile = obtained.path;
    isTemp = obtained.isTemp;
  } else if (messageType !== "video" && !mediaPath) {
    await updateInbox(inboxId, {
      processing_status: "error",
      processing_error:  "media.localPath ausente no webhook",
    });
    sendReply(downloadFailureReply(messageType));
    return;
  }

  try {
    let extractedText = null;
    let providerError = null;

    if (messageType === "audio") {
      const result = await transcribeAudio(mediaFile);
      extractedText = result.text;
      providerError = result.error || null;
      await updateInbox(inboxId, {
        transcription_text: extractedText,
        processing_status:  providerError && !extractedText ? "error" : "done",
        processing_error:   providerError,
      });

    } else if (messageType === "image" || messageType === "document") {
      const result = await extractImageText(mediaFile, mediaMimetype || "image/jpeg");
      extractedText = result.text;
      providerError = result.error || null;
      await updateInbox(inboxId, {
        ocr_text:          extractedText,
        processing_status: providerError && !extractedText ? "error" : "done",
        processing_error:  providerError,
      });

      if (caption && extractedText) {
        extractedText = `${extractedText} ${caption}`;
      } else if (caption && !extractedText) {
        extractedText = caption;
      }

    } else {
      await updateInbox(inboxId, { processing_status: "done" });
      return;
    }

    const parsed = extractedText ? parseMessage(extractedText) : null;

    if (!parsed) {
      const msg = messageType === "audio"
        ? (extractedText
            ? `🎵 Transcrevi: "${extractedText.slice(0, 120)}"\nMas não consegui identificar valor e descrição. Envie no formato: paguei 50 gasolina`
            : "🎵 Recebi seu áudio, mas não consegui transcrever. Envie um texto: paguei 50 gasolina")
        : (extractedText
            ? `🧾 Extraí do comprovante: "${extractedText.slice(0, 120)}"\nMas não consegui identificar valor e descrição claramente.`
            : "🧾 Recebi o comprovante, mas ainda não consegui identificar valor e descrição. Envie um texto: paguei 50 gasolina");

      sendReply(msg);
      console.log(
        `[mediaProcessor] sem parse: inbox=${inboxId} tipo=${messageType}` +
        ` text="${(extractedText || "").slice(0, 60)}"`
      );
      return;
    }

    try {
      const tipo = parsed.tipo === "Receita" ? "Entrada" : "Saida";
      const origem = messageType === "audio" ? "áudio" : "comprovante";

      // Multiambiente: se o usuário tem mais de 1 ambiente, perguntar em qual registrar
      const ambientes = await getAmbientesDoUsuario(usuarioId);
      if (ambientes.length > 1) {
        const payload = {
          action: "create_lancamento",
          step: "escolher_ambiente",
          ambientes_opcoes: ambientes,
          parsed: { ...parsed, _origem: origem },
        };
        await fpCreatePending(usuarioId, fromNumber, payload);
        sendReply(buildAmbienteSelectorMsg(ambientes));
        console.log(
          `[mediaProcessor] aguardando seleção de ambiente: inbox=${inboxId}` +
          ` tipo=${tipo} valor=${parsed.valor} origem=${origem}`
        );
        return;
      }

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
          observacao: `Criado via WhatsApp (${origem})`,
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

      await fpCreatePending(usuarioId, fromNumber, payload);
      sendReply(buildConfirmacaoMsg(payload));

      console.log(
        `[mediaProcessor] pending criado: inbox=${inboxId} tipo=${tipo}` +
        ` valor=${parsed.valor} desc=${parsed.descricao} origem=${origem}`
      );
    } catch (err) {
      console.error("[mediaProcessor] erro ao criar pending:", err.message);
      sendReply("Não consegui registrar o lançamento. Tente novamente ou envie um texto.");
    }
  } finally {
    cleanupTemp(mediaFile, isTemp);
  }
}
