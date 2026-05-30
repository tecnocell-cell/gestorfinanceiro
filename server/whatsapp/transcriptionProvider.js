/**
 * transcriptionProvider.js
 *
 * Transcrição de áudio para texto.
 * Provider selecionado por variável de ambiente:
 *
 *   OPENAI_API_KEY → OpenAI Whisper API (modelo whisper-1)
 *   (ausente)      → mock: retorna null
 *
 * Retorna:
 *   { text: string|null, provider: "whisper"|"mock", error?: string }
 */

import fs from "fs";
import path from "path";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Transcreve o arquivo de áudio no caminho informado.
 *
 * @param {string} filePath  - Caminho absoluto para o arquivo de áudio
 * @returns {Promise<{ text: string|null, provider: string, error?: string }>}
 */
export async function transcribeAudio(filePath) {
  if (!OPENAI_API_KEY) {
    console.log("[transcription] OPENAI_API_KEY ausente — usando mock (null)");
    return { text: null, provider: "mock" };
  }

  if (!fs.existsSync(filePath)) {
    return { text: null, provider: "whisper", error: `Arquivo não encontrado: ${filePath}` };
  }

  try {
    // Whisper aceita: flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm
    const fileBuffer = fs.readFileSync(filePath);
    const filename   = path.basename(filePath);

    // FormData via fetch (Node 18+)
    // FormData global (Node 18+)
    const formData = new globalThis.FormData();
    const blob     = new Blob([fileBuffer]);
    formData.append("file", blob, filename);
    formData.append("model", "whisper-1");
    formData.append("language", "pt");
    formData.append("response_format", "text");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method:  "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body:    formData,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Whisper HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const text = (await res.text()).trim();
    console.log(`[transcription] Whisper OK: "${text.slice(0, 80)}"`);
    return { text: text || null, provider: "whisper" };

  } catch (err) {
    console.error("[transcription] Whisper erro:", err.message);
    return { text: null, provider: "whisper", error: err.message.slice(0, 500) };
  }
}

