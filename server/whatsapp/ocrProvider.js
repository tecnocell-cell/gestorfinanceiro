/**
 * ocrProvider.js
 *
 * Wrapper fino sobre server/ai/providers/index.js.
 * Mantido para compatibilidade com importações existentes em mediaProcessor.js.
 *
 * Para selecionar o provider configure:
 *   OCR_PROVIDER=openai|mock   (default: openai se OPENAI_API_KEY presente)
 *   OPENAI_API_KEY=sk-...
 */

export { extractReceiptData as extractImageText } from "../ai/providers/index.js";
