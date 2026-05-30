/**
 * openaiProvider.js
 *
 * Provider OpenAI:
 *   transcribeAudio    → Whisper API (whisper-1, language=pt)
 *   extractReceiptData → GPT-4o-mini Vision com prompt estruturado
 *
 * Requer: OPENAI_API_KEY
 */

import fs   from "fs";
import path from "path";

const KEY = process.env.OPENAI_API_KEY;

const RECEIPT_PROMPT =
  "Você é um extrator de dados financeiros. " +
  "Analise esta imagem de comprovante ou documento financeiro. " +
  "Extraia o valor monetário principal e a descrição/tipo da transação. " +
  "Responda APENAS no formato: VALOR: <número> | DESCRIÇÃO: <texto curto>. " +
  "Se não encontrar valor monetário claro, responda: SEM_VALOR. " +
  "Exemplos: 'VALOR: 150.00 | DESCRIÇÃO: transferência PIX recebida' " +
  "ou 'VALOR: 89.90 | DESCRIÇÃO: pagamento cartão supermercado'.";

// ── Transcrição de áudio ──────────────────────────────────────────────────────

/**
 * @param {string} filePath  Caminho absoluto para arquivo de áudio
 * @returns {Promise<{ text: string|null, provider: string, error?: string }>}
 */
export async function transcribeAudio(filePath) {
  if (!KEY) {
    return { text: null, provider: "openai-whisper", error: "OPENAI_API_KEY não configurada" };
  }
  if (!fs.existsSync(filePath)) {
    return { text: null, provider: "openai-whisper", error: `Arquivo não encontrado: ${filePath}` };
  }

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const filename   = path.basename(filePath);
    const formData   = new globalThis.FormData();
    formData.append("file", new Blob([fileBuffer]), filename);
    formData.append("model", "whisper-1");
    formData.append("language", "pt");
    formData.append("response_format", "text");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method:  "POST",
      headers: { Authorization: `Bearer ${KEY}` },
      body:    formData,
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Whisper HTTP ${res.status}: ${err.slice(0, 200)}`);
    }

    const text = (await res.text()).trim();
    console.log(`[ai/openai] Whisper OK: "${text.slice(0, 80)}"`);
    return { text: text || null, provider: "openai-whisper" };
  } catch (err) {
    console.error("[ai/openai] Whisper erro:", err.message);
    return { text: null, provider: "openai-whisper", error: err.message.slice(0, 500) };
  }
}

// ── OCR de comprovante ────────────────────────────────────────────────────────

/**
 * @param {string} filePath  Caminho absoluto para arquivo de imagem
 * @param {string} mimetype  MIME type (ex: "image/jpeg")
 * @returns {Promise<{ text: string|null, provider: string, error?: string }>}
 */
export async function extractReceiptData(filePath, mimetype = "image/jpeg") {
  if (!KEY) {
    return { text: null, provider: "openai-vision", error: "OPENAI_API_KEY não configurada" };
  }
  if (!fs.existsSync(filePath)) {
    return { text: null, provider: "openai-vision", error: `Arquivo não encontrado: ${filePath}` };
  }

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const base64     = fileBuffer.toString("base64");
    const safeType   = ["image/jpeg","image/png","image/webp","image/gif"].includes(mimetype)
      ? mimetype : "image/jpeg";

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method:  "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: RECEIPT_PROMPT },
            { type: "image_url", image_url: { url: `data:${safeType};base64,${base64}`, detail: "low" } },
          ],
        }],
        max_tokens: 200,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`OpenAI Vision HTTP ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || null;
    console.log(`[ai/openai] Vision OK: "${(text || "").slice(0, 80)}"`);
    return { text: text || null, provider: "openai-vision" };
  } catch (err) {
    console.error("[ai/openai] Vision erro:", err.message);
    return { text: null, provider: "openai-vision", error: err.message.slice(0, 500) };
  }
}
