/**
 * proLaboreWriter — compatibilidade Etapa 5.0C (delega a operacaoWriter)
 */

import {
  previewOperacao,
  confirmOperacao,
  rollbackOperacao,
  mapOperacao,
} from './operacaoWriter.js';

const TIPO = 'pro_labore';

export function previewProLabore(args) {
  return previewOperacao(TIPO, args);
}

export async function confirmProLabore(client, args) {
  return confirmOperacao(client, TIPO, args);
}

export { rollbackOperacao, mapOperacao };
