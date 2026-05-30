/**
 * server/ai/providers/index.js
 *
 * Ponto único de seleção de provider de IA.
 *
 * Variáveis de ambiente:
 *   TRANSCRIPTION_PROVIDER = openai | mock   (default: openai se OPENAI_API_KEY, senão mock)
 *   OCR_PROVIDER           = openai | mock   (default: openai se OPENAI_API_KEY, senão mock)
 *
 * Uso:
 *   import { transcribeAudio, extractReceiptData } from "../ai/providers/index.js";
 *
 * Nenhum outro arquivo deve importar openaiProvider diretamente.
 */

import * as openai from "./openaiProvider.js";
import * as mock   from "./mockProvider.js";

const hasOpenAI = !!process.env.OPENAI_API_KEY;

function selectProvider(envVar) {
  const val = (process.env[envVar] || "").toLowerCase().trim();
  if (val === "mock") return "mock";
  if (val === "openai") return "openai";
  // auto-detect: usa openai se a chave existir
  return hasOpenAI ? "openai" : "mock";
}

const transcriptionProvider = selectProvider("TRANSCRIPTION_PROVIDER");
const ocrProvider            = selectProvider("OCR_PROVIDER");

console.log(
  `[ai/providers] transcrição=${transcriptionProvider} ocr=${ocrProvider}` +
  ` OPENAI_API_KEY=${hasOpenAI ? "presente" : "ausente"}`
);

/**
 * Transcreve áudio para texto.
 * @param {string} filePath
 * @returns {Promise<{ text: string|null, provider: string, error?: string }>}
 */
export async function transcribeAudio(filePath) {
  return transcriptionProvider === "openai"
    ? openai.transcribeAudio(filePath)
    : mock.transcribeAudio(filePath);
}

/**
 * Extrai dados financeiros de imagem/comprovante.
 * @param {string} filePath
 * @param {string} mimetype
 * @returns {Promise<{ text: string|null, provider: string, error?: string }>}
 */
export async function extractReceiptData(filePath, mimetype) {
  return ocrProvider === "openai"
    ? openai.extractReceiptData(filePath, mimetype)
    : mock.extractReceiptData(filePath, mimetype);
}
