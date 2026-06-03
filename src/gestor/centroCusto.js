/**
 * Centros de custo / projetos — estado da empresa (centroCustos[]).
 */
import { addMoney, filterLancamentos, generateId, subMoney, safeNum } from "./finance.js";

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

function isPlanoReceita(plano) {
  return plano?.tipo === "Receita";
}

function isPlanoDespesa(plano, { isPF } = {}) {
  if (!plano) return false;
  if (isPF) return plano.tipo === "Despesa";
  return plano.tipo === "Despesa" || plano.tipo === "Custo" || plano.tipo === "Imposto";
}

/**
 * Resultado por centro de custo no período (receitas, despesas, resultado).
 * Lançamentos sem centroCustoId agrupam em linha id=null.
 */
export function getResultadoPorCentroCusto(
  lancamentos,
  planoContas,
  centroCustos,
  { ano, mes, isPF = false } = {}
) {
  const filtered = filterLancamentos(lancamentos || [], { ano, mes });
  const planoById = new Map((planoContas || []).map((p) => [p.id, p]));
  const buckets = new Map();

  const touch = (key) => {
    if (!buckets.has(key)) {
      buckets.set(key, { centroCustoId: key === "__none__" ? null : key, receitas: 0, despesas: 0 });
    }
    return buckets.get(key);
  };

  for (const l of filtered) {
    if (l.tipo === "Transferencia") continue;
    const plano = planoById.get(l.planoId);
    if (!plano) continue;
    const key = l.centroCustoId || "__none__";
    const row = touch(key);
    const val = safeNum(l.valor);
    if (isPlanoReceita(plano) && l.tipo === "Entrada") {
      row.receitas = addMoney(row.receitas, val);
    } else if (isPlanoDespesa(plano, { isPF }) && l.tipo === "Saida") {
      row.despesas = addMoney(row.despesas, val);
    }
  }

  const nomeById = new Map((centroCustos || []).map((c) => [c.id, c.nome]));
  const statusById = new Map((centroCustos || []).map((c) => [c.id, c.status]));

  const rows = [...buckets.values()].map((row) => ({
    ...row,
    nome: row.centroCustoId
      ? nomeById.get(row.centroCustoId) || "Centro removido"
      : "Sem centro de custo",
    status: row.centroCustoId ? statusById.get(row.centroCustoId) || "inativo" : null,
    resultado: subMoney(row.receitas, row.despesas),
  }));

  rows.sort((a, b) => {
    if (!a.centroCustoId) return 1;
    if (!b.centroCustoId) return -1;
    return String(a.nome).localeCompare(String(b.nome), "pt-BR");
  });

  const totais = rows.reduce(
    (acc, r) => ({
      receitas: addMoney(acc.receitas, r.receitas),
      despesas: addMoney(acc.despesas, r.despesas),
      resultado: addMoney(acc.resultado, r.resultado),
    }),
    { receitas: 0, despesas: 0, resultado: 0 }
  );

  return { rows, totais };
}
