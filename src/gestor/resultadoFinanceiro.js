/**
 * Agregação de receitas/despesas/resultado por dimensão (centro, cliente, projeto).
 */
import { addMoney, filterLancamentos, subMoney, safeNum } from "./finance.js";

function isPlanoReceita(plano) {
  return plano?.tipo === "Receita";
}

function isPlanoDespesa(plano, { isPF } = {}) {
  if (!plano) return false;
  if (isPF) return plano.tipo === "Despesa";
  return plano.tipo === "Despesa" || plano.tipo === "Custo" || plano.tipo === "Imposto";
}

/**
 * @param {string} fieldName - ex.: centroCustoId, clienteId, projetoId
 */
export function accumulateResultadoPorCampo(
  lancamentos,
  planoContas,
  fieldName,
  { ano, mes, isPF = false } = {}
) {
  const filtered = filterLancamentos(lancamentos || [], { ano, mes });
  const planoById = new Map((planoContas || []).map((p) => [p.id, p]));
  const buckets = new Map();

  const touch = (key) => {
    if (!buckets.has(key)) {
      buckets.set(key, {
        id: key === "__none__" ? null : key,
        receitas: 0,
        despesas: 0,
      });
    }
    return buckets.get(key);
  };

  for (const l of filtered) {
    if (l.tipo === "Transferencia") continue;
    const plano = planoById.get(l.planoId);
    if (!plano) continue;
    const key = l[fieldName] || "__none__";
    const row = touch(key);
    const val = safeNum(l.valor);
    if (isPlanoReceita(plano) && l.tipo === "Entrada") {
      row.receitas = addMoney(row.receitas, val);
    } else if (isPlanoDespesa(plano, { isPF }) && l.tipo === "Saida") {
      row.despesas = addMoney(row.despesas, val);
    }
  }

  return buckets;
}

export function finalizeResultadoRows(buckets, {
  idField,
  nomeResolver,
  statusResolver,
  semLabel,
  extraFields = () => ({}),
}) {
  const rows = [...buckets.values()].map((row) => {
    const id = row.id;
    return {
      [idField]: id,
      nome: id ? nomeResolver(id) : semLabel,
      status: id && statusResolver ? statusResolver(id) : null,
      receitas: row.receitas,
      despesas: row.despesas,
      resultado: subMoney(row.receitas, row.despesas),
      ...extraFields(id, row),
    };
  });

  rows.sort((a, b) => {
    if (!a[idField]) return 1;
    if (!b[idField]) return -1;
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
