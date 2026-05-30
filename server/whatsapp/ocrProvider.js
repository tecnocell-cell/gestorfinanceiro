/**
 * ocrProvider.js
 *
 * Extração de texto de imagens/documentos via OCR.
 * Provider selecionado por variável de ambiente:
 *
 *   OPENAI_API_KEY → GPT-4o-mini Vision (extrai texto de comprovante)
 *   (ausente)      → mock: retorna null
 *
 * Retorna:
 *   { text: string|null, provider: "openai-vision"|"mock", error?: string }
 */

import fs from "fs";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const OCR_PROMPT =
  "Você é um extrator de dados financeiros. " +
  "Analise esta imagem de comprovante ou documento financeiro. " +
  "Extraia o valor monetário principal e a descrição/tipo da transação. " +
  "Responda APENAS no formato: VALOR: <número> | DESCRIÇÃO: <texto curto>. " +
  "Se não encontrar valor monetário claro, responda: SEM_VALOR. " +
  "Exemplos: 'VALOR: 150.00 | DESCRIÇÃO: transferência PIX recebida' " +
  "ou 'VALOR: 89.90 | DESCRIÇÃO: pagamento cartão supermercado'.";

/**
 * Extrai texto financeiro de uma imagem.
 *
 * @param {string} filePath  - Caminho absoluto para o arquivo de imagem
 * @param {string} mimetype  - MIME type (ex: "image/jpeg")
 * @returns {Promise<{ text: string|null, provider: string, error?: string }>}
 */
export async function extractImageText(filePath, mimetype = "image/jpeg") {
  if (!OPENAI_API_KEY) {
    console.log("[ocr] OPENAI_API_KEY ausente — usando mock (null)");
    return { text: null, provider: "mock" };
  }

  if (!fs.existsSync(filePath)) {
    return { text: null, provider: "openai-vision", error: `Arquivo não encontrado: ${filePath}` };
  }

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const base64     = fileBuffer.toString("base64");
    // Para documentos PDF, usa-se mime adequado; para imagens padrão
    const safeType = ["image/jpeg","image/png","image/webp","image/gif"].includes(mimetype)
      ? mimetype
      : "image/jpeg";

    const body = {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: OCR_PROMPT },
            {
              type: "image_url",
              image_url: { url: `data:${safeType};base64,${base64}`, detail: "low" },
            },
          ],
        },
      ],
      max_tokens: 200,
    };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`OpenAI Vision HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data    = await res.json();
    const text    = data?.choices?.[0]?.message?.content?.trim() || null;
    console.log(`[ocr] Vision OK: "${(text || "").slice(0, 80)}"`);
    return { text: text || null, provider: "openai-vision" };

  } catch (err) {
    console.error("[ocr] Vision erro:", err.message);
    return { text: null, provider: "openai-vision", error: err.message.slice(0, 500) };
  }
}
