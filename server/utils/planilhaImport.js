/**
 * planilhaImport — preview/confirmação CSV/XLSX (Etapa 4.7)
 */

import { gerarFingerprint } from './fingerprint.js';
import {
  classificarTransacoes,
  loadExistingFingerprints,
  confirmImport,
} from './ofxImport.js';
import { parseCsvForImport } from './parseCsv.js';
import { parseXlsxForImport } from './parseXlsx.js';

export async function previewPlanilhaImport(dbQuery, usuarioId, { fileContent, columnMap, parseFn }) {
  const parsed = parseFn(fileContent, columnMap || null);

  if (!columnMap) {
    return {
      headers: parsed.headers,
      previewRows: parsed.previewRows,
      suggestedMapping: parsed.suggestedMapping,
      totalRows: parsed.totalRows,
    };
  }

  const { txs } = parsed;
  const fingerprints = txs.map((tx) => gerarFingerprint(usuarioId, tx));
  const existingSet = await loadExistingFingerprints(dbQuery, usuarioId, fingerprints);
  const { transacoes, novas, duplicadas } = classificarTransacoes(usuarioId, txs, existingSet);

  return {
    banco: null,
    total: txs.length,
    novas,
    duplicadas,
    transacoes: transacoes.map(({ fingerprint, _raw, ...t }) => t),
    headers: parsed.headers,
    totalRows: parsed.totalRows,
  };
}

export async function confirmPlanilhaImport(client, {
  usuarioId,
  contaId,
  planoId,
  fileName,
  fileContent,
  columnMap,
  dados,
  parseFn,
  formato,
  source,
}) {
  const parsed = parseFn(fileContent, columnMap);
  return confirmImport(client, {
    usuarioId,
    contaId,
    planoId: planoId || null,
    fileName,
    dados,
    txs: parsed.txs,
    formato,
    source,
    bancoSlug: null,
    totalLinhas: parsed.totalRows ?? parsed.txs.length,
  });
}

export const parseCsvImport = parseCsvForImport;
export const parseXlsxImport = parseXlsxForImport;
