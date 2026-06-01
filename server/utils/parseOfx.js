/**
 * parseOfx — parser OFX/QIF server-side
 *
 * Suporta:
 *   - OFX 1.x (SGML — formato padrão dos bancos brasileiros)
 *   - OFX 2.x (XML — alguns exportadores modernos)
 *   - QIF simplificado (Quicken Interchange Format)
 *
 * Retorna array de transações brutas (sem IDs, sem lote).
 * O campo fitid é extraído quando presente — chave para deduplicação precisa.
 */

/** Normaliza data DTPOSTED do OFX (yyyymmdd[hhmmss[.mmm][+/-n:n]]) → yyyy-mm-dd */
function parseDtPosted(raw) {
  const s = String(raw || '').trim().slice(0, 8);
  if (s.length < 8) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/** Parse OFX 1.x (SGML — header + body não-XML) */
function parseOFXSgml(text) {
  const txs = [];
  const blocks = text.split(/<STMTTRN>/i).slice(1);

  for (const block of blocks) {
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}>([^<\n\r]+)`, 'i'));
      return m ? m[1].trim() : '';
    };

    const rawAmt  = get('TRNAMT').replace(',', '.');
    const amt     = parseFloat(rawAmt);
    const data    = parseDtPosted(get('DTPOSTED'));
    const memo    = get('MEMO') || get('NAME') || 'Importação OFX';
    const fitid   = get('FITID') || null;
    const bankId  = get('BANKID') || get('BROKERID') || null;

    if (!data || Number.isNaN(amt)) continue;

    txs.push({
      data,
      valor:    Math.abs(amt),
      tipo:     amt >= 0 ? 'Entrada' : 'Saida',
      historico: memo,
      fitid,
      _bankId:  bankId,
    });
  }

  return txs;
}

/** Parse OFX 2.x (XML válido com tags fechadas) */
function parseOFXXml(text) {
  const txs = [];
  const blocks = [...text.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)];

  for (const match of blocks) {
    const block = match[1];
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([^<]+)`, 'i'));
      return m ? m[1].trim() : '';
    };

    const amt   = parseFloat(get('TRNAMT').replace(',', '.'));
    const data  = parseDtPosted(get('DTPOSTED'));
    const memo  = get('MEMO') || get('NAME') || 'Importação OFX';
    const fitid = get('FITID') || null;

    if (!data || Number.isNaN(amt)) continue;

    txs.push({
      data,
      valor:    Math.abs(amt),
      tipo:     amt >= 0 ? 'Entrada' : 'Saida',
      historico: memo,
      fitid,
      _bankId:  null,
    });
  }

  return txs;
}

/** Parse QIF simplificado (Quicken Interchange Format) */
function parseQIF(text) {
  const txs = [];
  const entries = text.split(/^\^/m);

  for (const entry of entries) {
    const lines = entry.split(/\r?\n/).filter(Boolean);
    let data = null, valor = null, memo = '';

    for (const line of lines) {
      const code = line[0];
      const val  = line.slice(1).trim();
      if (code === 'D') {
        // Data: vários formatos (MM/DD/YYYY, DD/MM/YYYY, etc.)
        const parts = val.replace(/-/g, '/').split('/');
        if (parts.length === 3) {
          const [a, b, c] = parts.map(Number);
          // Heurística: se terceiro campo > 31, é ano (MM/DD/YYYY)
          if (c > 31) data = `${c}-${String(a).padStart(2,'0')}-${String(b).padStart(2,'0')}`;
          else        data = `${a}-${String(b).padStart(2,'0')}-${String(c).padStart(2,'0')}`;
        }
      } else if (code === 'T' || code === 'U') {
        valor = parseFloat(val.replace(/[,]/g, '').replace(/\./g, '') === val.replace(/,/g,'')
          ? val.replace(',', '.')
          : val.replace(/\./g, '').replace(',', '.'));
      } else if (code === 'P' || code === 'M') {
        if (!memo) memo = val;
      }
    }

    if (!data || valor === null || Number.isNaN(valor) || valor === 0) continue;

    txs.push({
      data,
      valor:    Math.abs(valor),
      tipo:     valor >= 0 ? 'Entrada' : 'Saida',
      historico: memo || 'Importação QIF',
      fitid:    null,
      _bankId:  null,
    });
  }

  return txs;
}

/**
 * Detecta o banco a partir do header OFX (campo FI/ORG ou BANKID)
 * Retorna slug compatível com conexoes_bancarias ou null
 */
function detectBancoSlug(text, txs) {
  const orgMatch = text.match(/<ORG>([^<\n]+)/i);
  const org = orgMatch ? orgMatch[1].trim().toLowerCase() : '';

  const bankMatch = text.match(/<BANKID>(\d+)/i);
  const bankId = bankMatch ? bankMatch[1] : '';

  // Mapeamento de IDs de banco BR e nomes comuns
  const map = {
    '001': 'bb', 'banco do brasil': 'bb',
    '033': 'santander', 'santander': 'santander',
    '104': 'caixa', 'caixa economica': 'caixa',
    '237': 'bradesco', 'bradesco': 'bradesco',
    '341': 'itau', 'itau': 'itau', 'itaú': 'itau',
    '260': 'nubank', 'nubank': 'nubank',
    '077': 'inter', 'inter': 'inter',
    '336': 'c6', 'c6 bank': 'c6',
  };

  return map[bankId] || map[org] || null;
}

/**
 * Ponto de entrada principal
 * @param {string} text — conteúdo do arquivo OFX/QIF como string
 * @returns {{ txs: Array, bancoSlug: string|null, formato: string }}
 */
export function parseOfxFile(text) {
  const trimmed = text.trimStart();

  // QIF detection
  if (trimmed.startsWith('!Type:') || trimmed.startsWith('!Account')) {
    return { txs: parseQIF(text), bancoSlug: null, formato: 'OFX' };
  }

  // OFX 2.x (XML)
  if (trimmed.startsWith('<?') || trimmed.startsWith('<OFX>')) {
    const txs = parseOFXXml(text);
    return { txs, bancoSlug: detectBancoSlug(text, txs), formato: 'OFX' };
  }

  // OFX 1.x (SGML — padrão mais comum no Brasil)
  const txs = parseOFXSgml(text);
  return { txs, bancoSlug: detectBancoSlug(text, txs), formato: 'OFX' };
}
