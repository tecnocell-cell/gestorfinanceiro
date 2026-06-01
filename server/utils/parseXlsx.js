/**
 * parseXlsx — parser XLSX server-side com mapeamento de colunas (Etapa 4.7)
 */

import * as XLSX from 'xlsx';
import {
  mapRowsToTransactions,
  suggestColumnMapping,
} from './parseCsv.js';

export function parseXlsxBuffer(buffer) {
  if (!buffer?.length) {
    const err = new Error('Arquivo XLSX vazio ou inválido.');
    err.status = 422;
    throw err;
  }

  let wb;
  try {
    wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  } catch {
    const err = new Error('Não foi possível interpretar o arquivo XLSX.');
    err.status = 422;
    throw err;
  }

  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    const err = new Error('Planilha XLSX sem abas.');
    err.status = 422;
    throw err;
  }

  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

  if (!rows.length) {
    const err = new Error('Planilha XLSX sem linhas de dados.');
    err.status = 422;
    throw err;
  }

  const headers = Object.keys(rows[0]);
  const normalizedRows = rows.map((row) => {
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      if (v instanceof Date) {
        out[k] = v.toISOString().slice(0, 10);
      } else {
        out[k] = String(v ?? '').trim();
      }
    }
    return out;
  });

  return { headers, rows: normalizedRows };
}

export function parseXlsxBase64(base64Content) {
  if (!base64Content || typeof base64Content !== 'string') {
    const err = new Error('Campo fileContent (base64) obrigatório para XLSX.');
    err.status = 400;
    throw err;
  }
  const buffer = Buffer.from(base64Content, 'base64');
  return parseXlsxBuffer(buffer);
}

export function parseXlsxForImport(base64Content, columnMap) {
  const { headers, rows } = parseXlsxBase64(base64Content);

  if (!columnMap) {
    return {
      headers,
      previewRows: rows.slice(0, 10),
      suggestedMapping: suggestColumnMapping(headers),
      totalRows: rows.length,
      txs: [],
    };
  }

  const txs = mapRowsToTransactions(rows, columnMap, 'Importação XLSX');
  if (!txs.length) {
    const err = new Error('Nenhuma transação válida encontrada com o mapeamento informado.');
    err.status = 422;
    throw err;
  }

  return { headers, rows, txs, totalRows: rows.length };
}
