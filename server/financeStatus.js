/**
 * Regras unificadas de status de lançamento — servidor (Etapa 7.8B).
 * Espelha src/gestor/financeStatus.js para testes e scripts.
 */

const PAGO_STATUSES = new Set(['pago', 'quitada']);

export function normalizeLancamentoStatus(l) {
  if (!l || typeof l !== 'object') return 'pendente';
  if (l.pago === true || PAGO_STATUSES.has(l.status)) return 'pago';
  if (l.pago === false || l.status === 'pendente') return 'pendente';
  if (l.consiliado) return 'pago';
  return 'pendente';
}

export function isLancamentoPago(l) {
  return normalizeLancamentoStatus(l) === 'pago';
}

export function isLancamentoPendente(l) {
  return !isLancamentoPago(l);
}

export function getDataRealizacao(l) {
  if (!l) return null;
  const raw = l.dataPagamento || l.pagoEm || l.quitadoEm || l.data || l.vencimento || null;
  if (!raw) return null;
  const s = String(raw).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export function isLancamentoVencido(l, hoje) {
  if (isLancamentoPago(l)) return false;
  const ref = String(hoje || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const venc = String(l?.vencimento || l?.data || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(venc)) return false;
  return venc < ref;
}

export function getValorRealizado(l) {
  if (!isLancamentoPago(l)) return 0;
  const v = Number(l?.valor);
  return Number.isFinite(v) ? v : 0;
}

export function inPeriodoRealizacao(l, { ano, mes }) {
  const dataRef = getDataRealizacao(l);
  if (!dataRef) return false;
  if (ano && !dataRef.startsWith(String(ano))) return false;
  if (mes && dataRef.slice(5, 7) !== String(mes).padStart(2, '0')) return false;
  return true;
}

export function filterLancamentosRealizados(lancamentos, opts = {}) {
  const { ano, mes, tipo } = opts;
  return (lancamentos || []).filter((l) => {
    if (!isLancamentoPago(l)) return false;
    if (tipo && tipo !== 'Todos' && l.tipo !== tipo) return false;
    return inPeriodoRealizacao(l, { ano, mes });
  });
}
