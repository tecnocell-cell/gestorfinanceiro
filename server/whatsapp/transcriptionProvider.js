/**
 * transcriptionProvider.js
 *
 * Wrapper fino sobre server/ai/providers/index.js.
 * Mantido para compatibilidade com importações existentes em mediaProcessor.js.
 *
 * Para selecionar o provider configure:
 *   TRANSCRIPTION_PROVIDER=openai|mock   (default: openai se OPENAI_API_KEY presente)
 *   OPENAI_API_KEY=sk-...
 */

export { transcribeAudio } from "../ai/providers/index.js";
