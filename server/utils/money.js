/**
 * Utilitários monetários no servidor (espelha src/gestor/finance.js).
 * Converte via string com 2 casas — evita 14999,98 quando o usuário digita 15000.
 */

export function reaisFromCentavos(centavos) {
  const c = Math.round(Number(centavos));
  if (!Number.isFinite(c)) return 0;
  const neg = c < 0;
  const abs = Math.abs(c);
  const ints = Math.floor(abs / 100);
  const decs = abs % 100;
  const n = Number(`${ints}.${String(decs).padStart(2, '0')}`);
  return neg ? -n : n;
}

/** Interpreta "15000", "15000,00", "15.000,00", 15000 (number). */
export function parseDecimalMoneyString(valor) {
  if (valor == null || valor === '') return null;

  if (typeof valor === 'number' && Number.isFinite(valor)) {
    return Number(valor.toFixed(2));
  }

  let t = String(valor).trim().replace(/\s/g, '').replace(/^R\$/i, '');
  if (!t) return null;

  const lastComma = t.lastIndexOf(',');
  const lastDot = t.lastIndexOf('.');

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      t = t.replace(/\./g, '').replace(',', '.');
    } else {
      t = t.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    t = t.replace(',', '.');
  } else if (lastDot > -1) {
    const parts = t.split('.');
    if (parts.length > 2) {
      t = parts.join('');
    }
  }

  const raw = parseFloat(t);
  return Number.isFinite(raw) && raw > 0 ? Number(raw.toFixed(2)) : null;
}

export function parseValorToCentavos(valor) {
  const reais = parseDecimalMoneyString(valor);
  if (reais == null || reais <= 0) {
    const err = new Error('Valor deve ser maior que zero.');
    err.status = 400;
    throw err;
  }

  const [intPart, decPart = '00'] = reais.toFixed(2).split('.');
  const cents =
    parseInt(intPart, 10) * 100 + parseInt(decPart.slice(0, 2).padEnd(2, '0'), 10);

  if (!Number.isFinite(cents) || cents <= 0) {
    const err = new Error('Valor deve ser maior que zero.');
    err.status = 400;
    throw err;
  }
  return cents;
}

/** Centavos inteiros vindos do cliente (sem float * 100). */
export function parseCentavosInteiro(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  if (/^\d+$/.test(s)) {
    const c = parseInt(s, 10);
    return Number.isFinite(c) && c > 0 ? c : null;
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  const c = Math.trunc(n);
  return c > 0 ? c : null;
}

/**
 * Aceita valorCentavos (inteiro) do cliente ou valor em reais/string.
 * Nunca usa Math.round(valor * 100).
 */
export function resolveValorCentavos(body = {}) {
  const rawCents = body.valorCentavos ?? body.valor_centavos;
  const fromCents = parseCentavosInteiro(rawCents);

  if (fromCents != null) {
    if (body.valor != null && body.valor !== '') {
      try {
        const fromReais = parseValorToCentavos(body.valor);
        if (Math.abs(fromCents - fromReais) > 1) {
          const err = new Error(
            'valorCentavos e valor em reais divergem. Envie apenas valorCentavos (inteiro).'
          );
          err.status = 400;
          throw err;
        }
      } catch (e) {
        if (e.status === 400 && e.message?.includes('divergem')) throw e;
        /* valor inválido no body — ignora e usa só centavos */
      }
    }
    return fromCents;
  }

  return parseValorToCentavos(body.valor);
}

export function parseValor(valor) {
  return reaisFromCentavos(parseValorToCentavos(valor));
}

export function roundMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(2));
}

/** Centavos inteiros a partir de valor em reais já normalizado. */
export function reaisToCentavos(valor) {
  const reais = roundMoney(Math.abs(Number(valor)));
  const [intPart, decPart = '00'] = reais.toFixed(2).split('.');
  return parseInt(intPart, 10) * 100 + parseInt(decPart.slice(0, 2).padEnd(2, '0'), 10);
}
