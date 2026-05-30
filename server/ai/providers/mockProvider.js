/**
 * mockProvider.js
 *
 * Provider mock — usado quando nenhuma chave de IA está configurada.
 * Retorna sempre null sem erros, sem chamadas externas.
 */

export async function transcribeAudio(_filePath) {
  console.log("[ai/mock] transcribeAudio — sem provider configurado, retornando null");
  return { text: null, provider: "mock" };
}

export async function extractReceiptData(_filePath, _mimetype) {
  console.log("[ai/mock] extractReceiptData — sem provider configurado, retornando null");
  return { text: null, provider: "mock" };
}
