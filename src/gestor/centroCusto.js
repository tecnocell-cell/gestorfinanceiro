/**
 * Centros de custo — estado da empresa (centroCustos[]).
 */
import { generateId } from "./finance.js";
import {
  accumulateResultadoPorCampo,
  finalizeResultadoRows,
} from "./resultadoFinanceiro.js";

export const CENTRO_CUSTO_STATUS = {
  ATIVO: "ativo",
  INATIVO: "inativo",
};

export function createCentroCusto({ nome, descricao = "" }) {
  return {
    id: generateId(),
    nome: String(nome || "").trim(),
    descricao: String(descricao || "").trim(),
    status: CENTRO_CUSTO_STATUS.ATIVO,
  };
}

export function getCentroCustoLabel(centroCustos, centroCustoId) {
  if (!centroCustoId) return "Sem centro de custo";
  const cc = (centroCustos || []).find((c) => c.id === centroCustoId);
  return cc?.nome || "Centro removido";
}

export function centrosCustoAtivos(centroCustos) {
  return (centroCustos || []).filter((c) => c.status === CENTRO_CUSTO_STATUS.ATIVO);
}

export function getResultadoPorCentroCusto(
  lancamentos,
  planoContas,
  centroCustos,
  { ano, mes, isPF = false } = {}
) {
  const buckets = accumulateResultadoPorCampo(lancamentos, planoContas, "centroCustoId", {
    ano,
    mes,
    isPF,
  });
  const nomeById = new Map((centroCustos || []).map((c) => [c.id, c.nome]));
  const statusById = new Map((centroCustos || []).map((c) => [c.id, c.status]));

  return finalizeResultadoRows(buckets, {
    idField: "centroCustoId",
    semLabel: "Sem centro de custo",
    nomeResolver: (id) => nomeById.get(id) || "Centro removido",
    statusResolver: (id) => statusById.get(id) || "inativo",
  });
}
