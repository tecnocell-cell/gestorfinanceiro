/**
 * Regras unificadas de status de lançamento (Etapa 7.8C).
 * vencimento = previsto | dataPagamento = realizado | pago sai do previsto
 */

const PAGO_STATUSES = new Set(["pago", "quitada"]);

function toDateKey(raw) {
  if (!raw) return null;
  const s = String(raw).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export function normalizeLancamentoStatus(l) {
  if (!l || typeof l !== "object") return "pendente";
  if (l.pago === true || PAGO_STATUSES.has(l.status)) return "pago";
  if (l.pago === false || l.status === "pendente") return "pendente";
  if (l.consiliado) return "pago";
  return "pendente";
}

export function isLancamentoPago(l) {
  return normalizeLancamentoStatus(l) === "pago";
}

export function isLancamentoPendente(l) {
  return !isLancamentoPago(l);
}

export function getDataPagamento(l) {
  if (!l) return null;
  return toDateKey(l.dataPagamento || l.pagoEm || l.quitadoEm);
}

export function getDataPrevista(l) {
  if (!l) return null;
  return toDateKey(l.vencimento || l.data);
}

export function getDataRealizacao(l) {
  if (!l || !isLancamentoPago(l)) return null;
  return getDataPagamento(l) || toDateKey(l.data);
}

export function isLancamentoVencido(l, hoje) {
  if (isLancamentoPago(l)) return false;
  const ref = String(hoje || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const venc = getDataPrevista(l);
  if (!venc) return false;
  return venc < ref;
}

export function getValorRealizado(l) {
  if (!isLancamentoPago(l)) return 0;
  const v = Number(l?.valor);
  return Number.isFinite(v) ? v : 0;
}

/** Status visual para Contas a Pagar/Receber */
export function getStatusLancamentoDisplay(l, hoje) {
  if (isLancamentoPago(l)) return "pago";
  if (isLancamentoVencido(l, hoje)) return "atrasado";
  return "pendente";
}

export function inPeriodoRealizacao(l, { ano, mes }) {
  const dataRef = getDataRealizacao(l);
  if (!dataRef) return false;
  if (ano && !dataRef.startsWith(String(ano))) return false;
  if (mes && dataRef.slice(5, 7) !== String(mes).padStart(2, "0")) return false;
  return true;
}

export function inPeriodoPrevisto(l, { ano, mes }) {
  const dataRef = getDataPrevista(l);
  if (!dataRef) return false;
  if (ano && !dataRef.startsWith(String(ano))) return false;
  if (mes && dataRef.slice(5, 7) !== String(mes).padStart(2, "0")) return false;
  return true;
}

export function filterLancamentosRealizados(lancamentos, opts = {}) {
  const { ano, mes, tipo } = opts;
  return (lancamentos || []).filter((l) => {
    if (!isLancamentoPago(l)) return false;
    if (tipo && tipo !== "Todos" && l.tipo !== tipo) return false;
    return inPeriodoRealizacao(l, { ano, mes });
  });
}

export function filterLancamentosPrevistos(lancamentos, opts = {}) {
  const { hoje, ate, ano, mes, tipo } = opts;
  const refHoje = hoje || new Date().toISOString().slice(0, 10);
  return (lancamentos || []).filter((l) => {
    if (l.tipo === "Transferencia") return false;
    if (!isLancamentoPendente(l)) return false;
    if (tipo && tipo !== "Todos" && l.tipo !== tipo) return false;
    const prev = getDataPrevista(l);
    if (!prev) return false;
    if (ate && prev > ate) return false;
    if (hoje && prev < refHoje) return false;
    if (ano || mes) return inPeriodoPrevisto(l, { ano, mes });
    return true;
  });
}
