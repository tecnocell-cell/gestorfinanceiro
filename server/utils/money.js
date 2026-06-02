/**
 * Utilitários monetários no servidor (espelha src/gestor/finance.js).
 * Sempre gravar valores a partir de centavos inteiros para evitar 4999,99 em vez de 5000,00.
 */

export function reaisFromCentavos(centavos) {
  const c = Math.round(Number(centavos));
  if (!Number.isFinite(c)) return 0;
  return Number((c / 100).toFixed(2));
}

export function parseValorToCentavos(valor) {
  const raw =
    typeof valor === 'number'
      ? valor
      : parseFloat(String(valor || '').trim().replace(',', '.'));
  if (!Number.isFinite(raw) || raw <= 0) {
    const err = new Error('Valor deve ser maior que zero.');
    err.status = 400;
    throw err;
  }
  return Math.round(raw * 100);
}

export function parseValor(valor) {
  return reaisFromCentavos(parseValorToCentavos(valor));
}
