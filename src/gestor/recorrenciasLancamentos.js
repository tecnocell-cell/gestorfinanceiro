/**
 * Geração segura de lançamentos a partir de recorrências.
 */
import { toDateKey } from "./finance.js";

export const SOURCE_RECORRENCIA = "recorrencia";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function monthKeyFromDate(dateVal) {
  const key = toDateKey(dateVal);
  return key ? key.slice(0, 7) : null;
}

export function getMesReferenciaAtual(filterPeriodo) {
  if (filterPeriodo?.ano && filterPeriodo?.mes) {
    const mes = String(filterPeriodo.mes).padStart(2, "0");
    return `${filterPeriodo.ano}-${mes}`;
  }
  const hoje = new Date().toISOString().slice(0, 10);
  return hoje.slice(0, 7);
}

export function formatMesReferencia(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return monthKey || "—";
  const [y, m] = monthKey.split("-");
  const idx = parseInt(m, 10) - 1;
  return `${MESES[idx] || m} ${y}`;
}

export function lancamentoRecorrenciaMes(lanc) {
  if (lanc.recorrenciaMes) return lanc.recorrenciaMes;
  return monthKeyFromDate(lanc.vencimento ?? lanc.data);
}

/** Já existe lançamento desta recorrência no mês (YYYY-MM)? */
export function isRecorrenciaGeradaNoMes(lancamentos, recorrenciaId, monthKey) {
  const id = String(recorrenciaId);
  return (lancamentos || []).some((l) => {
    if (String(l.recorrenciaId || "") !== id) return false;
    return lancamentoRecorrenciaMes(l) === monthKey;
  });
}

export function recorrenciaVenceNoMes(recorrencia, monthKey) {
  const mes = monthKeyFromDate(recorrencia?.proxima_data);
  return mes === monthKey;
}

/**
 * Classifica recorrências ativas para geração em lote do mês.
 */
export function classificarRecorrenciasParaMes(recorrencias, lancamentos, monthKey) {
  const elegiveis = [];
  const jaGeradas = [];
  const semConta = [];
  const foraDoMes = [];

  for (const rec of recorrencias || []) {
    if (rec.status !== "ativa") continue;
    if (!recorrenciaVenceNoMes(rec, monthKey)) {
      foraDoMes.push(rec);
      continue;
    }
    if (isRecorrenciaGeradaNoMes(lancamentos, rec.id, monthKey)) {
      jaGeradas.push(rec);
      continue;
    }
    if (!rec.conta_id) {
      semConta.push(rec);
      continue;
    }
    elegiveis.push(rec);
  }

  return { elegiveis, jaGeradas, semConta, foraDoMes };
}

/**
 * Monta payload de lançamento com vencimento/status/source corretos.
 */
export function buildLancamentoFromRecorrencia({
  recorrencia,
  lancamentos,
  contas,
  generateId,
  historico,
  valorOverride,
  vencimentoOverride,
}) {
  const dataVenc =
    toDateKey(vencimentoOverride ?? recorrencia.proxima_data) ||
    new Date().toISOString().slice(0, 10);
  const monthKey = monthKeyFromDate(dataVenc);
  const valor = valorOverride != null ? valorOverride : parseFloat(recorrencia.valor);
  const tipoLanc = recorrencia.tipo === "Receita" ? "Entrada" : "Saida";
  const contaId = recorrencia.conta_id;
  const conta = (contas || []).find((c) => c.id === contaId);

  const nums = (lancamentos || [])
    .map((l) => Number(l.codigo))
    .filter((n) => !Number.isNaN(n) && n > 0);
  const nextCodigo = nums.length ? Math.max(...nums) + 1 : 1;

  return {
    id: generateId(),
    codigo: nextCodigo,
    lote: `REC-${String(recorrencia.id).slice(0, 6)}-${monthKey?.replace("-", "") || ""}`,
    data: dataVenc,
    vencimento: dataVenc,
    tipo: tipoLanc,
    historico: historico ?? recorrencia.descricao,
    valor,
    contaEntradaId: tipoLanc === "Entrada" ? contaId : null,
    contaSaidaId: tipoLanc === "Saida" ? contaId : null,
    codigoDestino: tipoLanc === "Entrada" ? (conta?.codigo ?? null) : null,
    codigoOrigem: tipoLanc === "Saida" ? (conta?.codigo ?? null) : null,
    planoId: recorrencia.plano_id || null,
    clienteId: null,
    fornecedorId: null,
    consiliado: false,
    tipoOrigem: "",
    tipoDestino: "",
    source: SOURCE_RECORRENCIA,
    recorrenciaId: recorrencia.id,
    recorrenciaMes: monthKey,
    status: "pendente",
    pago: false,
  };
}
