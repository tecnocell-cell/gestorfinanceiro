/**
 * Geração segura de lançamentos a partir de recorrências.
 */
import { getStatusLancamento, toDateKey, safeNum } from "./finance.js";

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

/** Lançamento gerado desta recorrência no mês (YYYY-MM), se existir. */
export function findLancamentoRecorrenciaMes(lancamentos, recorrenciaId, monthKey) {
  const id = String(recorrenciaId);
  return (
    (lancamentos || []).find((l) => {
      if (String(l.recorrenciaId || "") !== id) return false;
      return lancamentoRecorrenciaMes(l) === monthKey;
    }) || null
  );
}

/** Já existe lançamento desta recorrência no mês (YYYY-MM)? */
export function isRecorrenciaGeradaNoMes(lancamentos, recorrenciaId, monthKey) {
  return !!findLancamentoRecorrenciaMes(lancamentos, recorrenciaId, monthKey);
}

/**
 * Situação da recorrência em relação ao mês de referência (tela / filtros).
 * codes: pendente_gerar | gerada_aberta | gerada_paga | gerada_atrasada | fora_mes | inativa
 */
export function getRecorrenciaLancamentoMesStatus(rec, lancamentos, mesReferencia) {
  if (rec.status !== "ativa") {
    return {
      code: "inativa",
      label: rec.status === "pausada" ? "Pausada" : "Encerrada",
      badge: "muted",
      canGerar: false,
      jaGerada: false,
    };
  }

  const lanc = findLancamentoRecorrenciaMes(lancamentos, rec.id, mesReferencia);
  if (lanc) {
    const st = getStatusLancamento(lanc);
    if (st === "pago") {
      return {
        code: "gerada_paga",
        label: "Lançada · Paga",
        badge: "green",
        canGerar: false,
        jaGerada: true,
        lancamento: lanc,
      };
    }
    if (st === "atrasado") {
      return {
        code: "gerada_atrasada",
        label: "Lançada · Atrasada",
        badge: "red",
        canGerar: false,
        jaGerada: true,
        lancamento: lanc,
      };
    }
    return {
      code: "gerada_aberta",
      label: "Lançada · Em aberto",
      badge: "blue",
      canGerar: false,
      jaGerada: true,
      lancamento: lanc,
    };
  }

  const mesProx = monthKeyFromDate(rec.proxima_data);
  if (mesProx && proximaAcimaDoMesReferencia(mesProx, mesReferencia)) {
    return {
      code: "fora_mes",
      label: mesProx ? `Aguardando ${formatMesReferencia(mesProx)}` : "Outro mês",
      badge: "muted",
      hint: `Mês ref.: ${formatMesReferencia(mesReferencia)}`,
      canGerar: false,
      jaGerada: false,
    };
  }

  if (!rec.conta_id) {
    return {
      code: "sem_conta",
      label: "Sem conta",
      badge: "muted",
      canGerar: false,
      jaGerada: false,
    };
  }

  if (podeGerarRecorrenciaNoMes(rec, lancamentos, mesReferencia)) {
    const venc = vencimentoNoMesReferencia(rec, mesReferencia);
    return {
      code: "pendente_gerar",
      label: "Falta gerar",
      badge: "amber",
      canGerar: true,
      jaGerada: false,
      hint: venc ? `Venc. ${venc.split("-").reverse().join("/")}` : undefined,
    };
  }

  return {
    code: "fora_mes",
    label: mesProx ? `Próximo: ${formatMesReferencia(mesProx)}` : "Outro mês",
    badge: "muted",
    hint: `Mês ref.: ${formatMesReferencia(mesReferencia)}`,
    canGerar: false,
    jaGerada: false,
  };
}

export function resumoRecorrenciasMes(recorrencias, lancamentos, mesReferencia) {
  const out = { faltaGerar: 0, emAberto: 0, pagas: 0, atrasadas: 0, foraMes: 0 };
  for (const rec of recorrencias || []) {
    if (rec.status !== "ativa") continue;
    const s = getRecorrenciaLancamentoMesStatus(rec, lancamentos, mesReferencia);
    if (s.code === "pendente_gerar") out.faltaGerar += 1;
    else if (s.code === "gerada_aberta") out.emAberto += 1;
    else if (s.code === "gerada_paga") out.pagas += 1;
    else if (s.code === "gerada_atrasada") out.atrasadas += 1;
    else if (s.code === "fora_mes") out.foraMes += 1;
  }
  return out;
}

export function recorrenciaVenceNoMes(recorrencia, monthKey) {
  const mes = monthKeyFromDate(recorrencia?.proxima_data);
  return mes === monthKey;
}

/** Vencimento no mês de referência (mesmo dia da proxima_data, ex.: 06). */
export function vencimentoNoMesReferencia(recorrencia, mesReferencia) {
  const prox = toDateKey(recorrencia?.proxima_data);
  if (!prox || !mesReferencia) return prox;
  const mesProx = monthKeyFromDate(prox);
  if (mesProx === mesReferencia) return prox;

  const day = parseInt(prox.slice(8, 10), 10);
  if (!Number.isFinite(day) || day < 1) return prox;

  const [y, m] = mesReferencia.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const d = Math.min(day, lastDay);
  return `${mesReferencia}-${String(d).padStart(2, "0")}`;
}

function monthIndex(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return null;
  const [y, m] = monthKey.split("-").map(Number);
  return y * 12 + m;
}

/** Próxima data ainda “longe” demais para gerar o mês ref. (ex.: prox. ago, ref. jun). */
function proximaAcimaDoMesReferencia(proximaMonthKey, mesReferencia) {
  const proxIdx = monthIndex(proximaMonthKey);
  const refIdx = monthIndex(mesReferencia);
  if (proxIdx == null || refIdx == null) return false;
  return proxIdx > refIdx + 1;
}

/** Pode gerar lançamento do mês ref. (ainda não gerado; ciclo não “futuro” demais). */
export function podeGerarRecorrenciaNoMes(recorrencia, lancamentos, mesReferencia) {
  if (recorrencia?.status !== "ativa") return false;
  if (!recorrencia.conta_id) return false;
  if (!mesReferencia) return false;
  if (isRecorrenciaGeradaNoMes(lancamentos, recorrencia.id, mesReferencia)) return false;

  const mesProx = monthKeyFromDate(recorrencia.proxima_data);
  if (!mesProx) return false;
  if (proximaAcimaDoMesReferencia(mesProx, mesReferencia)) return false;
  return true;
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

    if (isRecorrenciaGeradaNoMes(lancamentos, rec.id, monthKey)) {
      jaGeradas.push(rec);
      continue;
    }

    const mesProx = monthKeyFromDate(rec.proxima_data);
    if (mesProx && proximaAcimaDoMesReferencia(mesProx, monthKey)) {
      foraDoMes.push(rec);
      continue;
    }

    if (!rec.conta_id) {
      semConta.push(rec);
      continue;
    }

    if (podeGerarRecorrenciaNoMes(rec, lancamentos, monthKey)) {
      elegiveis.push(rec);
      continue;
    }

    foraDoMes.push(rec);
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
  const valor = valorOverride != null ? safeNum(valorOverride) : safeNum(recorrencia.valor);
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
    ...(recorrencia.centro_custo_id || recorrencia.centroCustoId
      ? { centroCustoId: recorrencia.centro_custo_id || recorrencia.centroCustoId }
      : {}),
    ...(recorrencia.cliente_id || recorrencia.clienteId
      ? { clienteId: recorrencia.cliente_id || recorrencia.clienteId }
      : {}),
    ...(recorrencia.projeto_id || recorrencia.projetoId
      ? { projetoId: recorrencia.projeto_id || recorrencia.projetoId }
      : {}),
  };
}
