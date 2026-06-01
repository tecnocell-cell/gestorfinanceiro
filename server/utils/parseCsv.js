/**
 * parseCsv — parser CSV server-side com mapeamento de colunas (Etapa 4.7)
 */

function detectDelimiter(firstLine) {
  const semi = (firstLine.match(/;/g) || []).length;
  const comma = (firstLine.match(/,/g) || []).length;
  return semi >= comma ? ';' : ',';
}

function parseCsvLine(line, delimiter) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

export function parseCsvRows(fileContent) {
  const text = String(fileContent || '').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    const err = new Error('CSV vazio ou sem linhas de dados.');
    err.status = 422;
    throw err;
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter).map((h) => h.replace(/^"|"$/g, '').trim());
  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i], delimiter);
    if (cols.every((c) => !c)) continue;
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = (cols[idx] ?? '').replace(/^"|"$/g, '').trim();
    });
    rows.push(row);
  }

  return { headers, rows, delimiter };
}

export function suggestColumnMapping(headers) {
  const norm = headers.map((h) => String(h || '').toLowerCase());
  const pick = (...terms) => {
    const idx = norm.findIndex((h) => terms.some((t) => h.includes(t)));
    return idx >= 0 ? headers[idx] : '';
  };
  return {
    data: pick('data', 'date', 'dt', 'dia'),
    historico: pick('histor', 'desc', 'memo', 'title', 'lanc', 'nome', 'detalhe'),
    valor: pick('valor', 'amount', 'value', 'quantia', 'total'),
    tipo: pick('tipo', 'type', 'natureza', 'operacao'),
  };
}

export function parseValorBr(raw) {
  let s = String(raw ?? '').trim();
  if (!s) return NaN;
  s = s.replace(/[R$\s]/gi, '');

  if (/^-?\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d+,\d{1,2}$/.test(s)) {
    s = s.replace(',', '.');
  }

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

export function parseDataBr(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }

  const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (br) {
    let [, d, m, y] = br;
    if (y.length === 2) y = `20${y}`;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function resolveTipo(rawTipo, valorNumerico) {
  const t = String(rawTipo || '').toLowerCase().trim();
  if (t.includes('entr') || t === 'c' || t.includes('cred') || t.includes('receita')) return 'Entrada';
  if (t.includes('sai') || t === 'd' || t.includes('deb') || t.includes('desp')) return 'Saida';
  return valorNumerico >= 0 ? 'Entrada' : 'Saida';
}

export function mapRowsToTransactions(rows, columnMap, defaultHistorico = 'Importação CSV') {
  if (!columnMap?.data || !columnMap?.valor || !columnMap?.historico) {
    const err = new Error('Mapeamento incompleto: data, valor e histórico são obrigatórios.');
    err.status = 400;
    throw err;
  }

  const txs = [];
  for (const row of rows) {
    const rawValor = row[columnMap.valor];
    const val = parseValorBr(rawValor);
    if (Number.isNaN(val) || val === 0) continue;

    const data = parseDataBr(row[columnMap.data]);
    if (!data) continue;

    const tipo = resolveTipo(columnMap.tipo ? row[columnMap.tipo] : '', val);
    const historico = String(row[columnMap.historico] || '').trim() || defaultHistorico;

    txs.push({
      data,
      valor: Math.abs(val),
      tipo,
      historico,
      fitid: null,
    });
  }

  return txs;
}

export function parseCsvForImport(fileContent, columnMap) {
  if (!fileContent || typeof fileContent !== 'string') {
    const err = new Error('Campo fileContent obrigatório.');
    err.status = 400;
    throw err;
  }

  const { headers, rows } = parseCsvRows(fileContent);

  if (!columnMap) {
    return {
      headers,
      previewRows: rows.slice(0, 10),
      suggestedMapping: suggestColumnMapping(headers),
      totalRows: rows.length,
      txs: [],
    };
  }

  const txs = mapRowsToTransactions(rows, columnMap);
  if (!txs.length) {
    const err = new Error('Nenhuma transação válida encontrada com o mapeamento informado.');
    err.status = 422;
    throw err;
  }

  return { headers, rows, txs, totalRows: rows.length };
}
