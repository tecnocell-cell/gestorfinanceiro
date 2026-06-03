/**
 * Etapa 6.0 — Orçamento previsto x realizado (centro, projeto, cliente).
 */
import { generateId, safeNum, addMoney, subMoney } from "./finance.js";
import { getResultadoPorCentroCusto } from "./centroCusto.js";
import {
  getResultadoPorCliente,
  getResultadoPorProjeto,
} from "./projetoFinanceiro.js";

export function normalizeMesOrcamento(mes) {
  if (mes == null || mes === "") return "";
  return String(mes).padStart(2, "0");
}

export function createOrcamentoMensal({
  referenciaId,
  ano,
  mes,
  valorReceitaPrevista = 0,
  valorDespesaPrevista = 0,
}) {
  return {
    id: generateId(),
    referenciaId,
    ano: String(ano || ""),
    mes: normalizeMesOrcamento(mes),
    valorReceitaPrevista: safeNum(valorReceitaPrevista),
    valorDespesaPrevista: safeNum(valorDespesaPrevista),
  };
}

export function findOrcamentoMensal(list, referenciaId, ano, mes) {
  const m = normalizeMesOrcamento(mes);
  return (list || []).find(
    (o) =>
      o.referenciaId === referenciaId &&
      String(o.ano) === String(ano) &&
      normalizeMesOrcamento(o.mes) === m
  );
}

function sumPrevistoPorReferencia(orcamentos) {
  const map = new Map();
  for (const o of orcamentos || []) {
    if (!o.referenciaId) continue;
    const cur = map.get(o.referenciaId) || {
      receitaPrevista: 0,
      despesaPrevista: 0,
    };
    cur.receitaPrevista = addMoney(cur.receitaPrevista, safeNum(o.valorReceitaPrevista));
    cur.despesaPrevista = addMoney(cur.despesaPrevista, safeNum(o.valorDespesaPrevista));
    map.set(o.referenciaId, cur);
  }
  return map;
}

function buildRowBase({
  referenciaId,
  nome,
  receitaPrevista,
  despesaPrevista,
  receitaRealizada,
  despesaRealizada,
  status = null,
  extra = {},
}) {
  const resultadoPrevisto = subMoney(receitaPrevista, despesaPrevista);
  const resultadoRealizado = subMoney(receitaRealizada, despesaRealizada);
  const variacaoReceita = subMoney(receitaRealizada, receitaPrevista);
  const variacaoDespesa = subMoney(despesaRealizada, despesaPrevista);
  const variacaoResultado = subMoney(resultadoRealizado, resultadoPrevisto);

  return {
    referenciaId,
    nome,
    status,
    receitaPrevista,
    receitaRealizada,
    variacaoReceita,
    despesaPrevista,
    despesaRealizada,
    variacaoDespesa,
    resultadoPrevisto,
    resultadoRealizado,
    variacaoResultado,
    alertaReceita: alertaReceita(variacaoReceita, receitaPrevista),
    alertaDespesa: alertaDespesa(variacaoDespesa, despesaPrevista),
    ...extra,
  };
}

/** Receita: acima do previsto = positivo; abaixo = negativo. */
export function alertaReceita(variacao, previsto) {
  if (!previsto || previsto === 0) return null;
  if (variacao > 0) return "acima";
  if (variacao < 0) return "abaixo";
  return null;
}

/** Despesa: acima do previsto = estourou; abaixo = economizou. */
export function alertaDespesa(variacao, previsto) {
  if (!previsto || previsto === 0) return null;
  if (variacao > 0) return "acima";
  if (variacao < 0) return "abaixo";
  return null;
}

function mergeIdsFromRealizado(rows, idField) {
  const ids = new Set();
  for (const r of rows) {
    if (r[idField]) ids.add(r[idField]);
  }
  return ids;
}

export function getOrcadoRealizadoPorCentro({
  lancamentos,
  planoContas,
  centroCustos,
  orcamentosCentros,
  ano,
  mes,
  isPF = false,
}) {
  const { rows: realRows } = getResultadoPorCentroCusto(lancamentos, planoContas, centroCustos, {
    ano,
    mes,
    isPF,
  });
  const previstoMap = sumPrevistoPorReferencia(orcamentosCentros);
  const nomeById = new Map((centroCustos || []).map((c) => [c.id, c.nome]));
  const statusById = new Map((centroCustos || []).map((c) => [c.id, c.status]));

  const ids = new Set([
    ...mergeIdsFromRealizado(realRows, "centroCustoId"),
    ...previstoMap.keys(),
  ]);

  const rows = [];
  for (const id of ids) {
    const real = realRows.find((r) => r.centroCustoId === id) || {
      receitas: 0,
      despesas: 0,
    };
    const prev = id ? previstoMap.get(id) : { receitaPrevista: 0, despesaPrevista: 0 };
    rows.push(
      buildRowBase({
        referenciaId: id,
        nome: id ? nomeById.get(id) || "Centro removido" : "Sem centro de custo",
        status: id ? statusById.get(id) : null,
        receitaPrevista: prev?.receitaPrevista || 0,
        despesaPrevista: prev?.despesaPrevista || 0,
        receitaRealizada: real.receitas,
        despesaRealizada: real.despesas,
      })
    );
  }

  const semReal = realRows.find((r) => !r.centroCustoId);
  if (semReal && !rows.some((r) => !r.referenciaId)) {
    rows.push(
      buildRowBase({
        referenciaId: null,
        nome: "Sem centro de custo",
        receitaPrevista: 0,
        despesaPrevista: 0,
        receitaRealizada: semReal.receitas,
        despesaRealizada: semReal.despesas,
      })
    );
  }

  return finalizeOrcadoRows(rows);
}

export function getOrcadoRealizadoPorProjeto({
  lancamentos,
  planoContas,
  projetos,
  clientes,
  orcamentosProjetos,
  ano,
  mes,
  isPF = false,
}) {
  const { rows: realRows } = getResultadoPorProjeto(
    lancamentos,
    planoContas,
    projetos,
    clientes,
    { ano, mes, isPF }
  );
  const previstoMap = sumPrevistoPorReferencia(orcamentosProjetos);
  const nomeById = new Map((projetos || []).map((p) => [p.id, p.nome]));
  const statusById = new Map((projetos || []).map((p) => [p.id, p.status]));
  const clienteByProjeto = new Map((projetos || []).map((p) => [p.id, p.clienteId]));
  const clienteNome = new Map((clientes || []).map((c) => [c.id, c.nome]));

  const ids = new Set([
    ...mergeIdsFromRealizado(realRows, "projetoId"),
    ...previstoMap.keys(),
  ]);

  const rows = [];
  for (const id of ids) {
    const real = realRows.find((r) => r.projetoId === id) || {
      receitas: 0,
      despesas: 0,
    };
    const prev = id ? previstoMap.get(id) : { receitaPrevista: 0, despesaPrevista: 0 };
    const cid = id ? clienteByProjeto.get(id) : null;
    rows.push(
      buildRowBase({
        referenciaId: id,
        nome: id ? nomeById.get(id) || "Projeto removido" : "Sem projeto",
        status: id ? statusById.get(id) : null,
        receitaPrevista: prev?.receitaPrevista || 0,
        despesaPrevista: prev?.despesaPrevista || 0,
        receitaRealizada: real.receitas,
        despesaRealizada: real.despesas,
        extra: { clienteNome: cid ? clienteNome.get(cid) || "—" : null },
      })
    );
  }

  const semReal = realRows.find((r) => !r.projetoId);
  if (semReal && !rows.some((r) => !r.referenciaId)) {
    rows.push(
      buildRowBase({
        referenciaId: null,
        nome: "Sem projeto",
        receitaPrevista: 0,
        despesaPrevista: 0,
        receitaRealizada: semReal.receitas,
        despesaRealizada: semReal.despesas,
      })
    );
  }

  return finalizeOrcadoRows(rows);
}

/** Previsto por cliente = soma dos orçamentos dos projetos vinculados. */
export function getOrcadoRealizadoPorCliente({
  lancamentos,
  planoContas,
  clientes,
  projetos,
  orcamentosProjetos,
  ano,
  mes,
  isPF = false,
}) {
  const { rows: realRows } = getResultadoPorCliente(lancamentos, planoContas, clientes, {
    ano,
    mes,
    isPF,
  });

  const previstoPorCliente = new Map();
  const projetoCliente = new Map((projetos || []).map((p) => [p.id, p.clienteId]));
  for (const o of orcamentosProjetos || []) {
    const cid = projetoCliente.get(o.referenciaId) || null;
    const key = cid || "__none__";
    const cur = previstoPorCliente.get(key) || {
      receitaPrevista: 0,
      despesaPrevista: 0,
    };
    cur.receitaPrevista = addMoney(cur.receitaPrevista, safeNum(o.valorReceitaPrevista));
    cur.despesaPrevista = addMoney(cur.despesaPrevista, safeNum(o.valorDespesaPrevista));
    previstoPorCliente.set(key, cur);
  }

  const nomeById = new Map((clientes || []).map((c) => [c.id, c.nome]));
  const ids = new Set([
    ...mergeIdsFromRealizado(realRows, "clienteId"),
    ...[...previstoPorCliente.keys()].filter((k) => k !== "__none__"),
  ]);

  const rows = [];
  for (const id of ids) {
    const real = realRows.find((r) => r.clienteId === id) || {
      receitas: 0,
      despesas: 0,
    };
    const prev = previstoPorCliente.get(id) || {
      receitaPrevista: 0,
      despesaPrevista: 0,
    };
    rows.push(
      buildRowBase({
        referenciaId: id,
        nome: id ? nomeById.get(id) || "Cliente removido" : "Sem cliente",
        receitaPrevista: prev.receitaPrevista,
        despesaPrevista: prev.despesaPrevista,
        receitaRealizada: real.receitas,
        despesaRealizada: real.despesas,
      })
    );
  }

  const semReal = realRows.find((r) => !r.clienteId);
  const prevSem = previstoPorCliente.get("__none__");
  if (
    (semReal || prevSem) &&
    !rows.some((r) => !r.referenciaId)
  ) {
    rows.push(
      buildRowBase({
        referenciaId: null,
        nome: "Sem cliente",
        receitaPrevista: prevSem?.receitaPrevista || 0,
        despesaPrevista: prevSem?.despesaPrevista || 0,
        receitaRealizada: semReal?.receitas || 0,
        despesaRealizada: semReal?.despesas || 0,
      })
    );
  }

  return finalizeOrcadoRows(rows);
}

function finalizeOrcadoRows(rows) {
  rows.sort((a, b) => {
    if (!a.referenciaId) return 1;
    if (!b.referenciaId) return -1;
    return String(a.nome).localeCompare(String(b.nome), "pt-BR");
  });

  const totais = rows.reduce(
    (acc, r) => ({
      receitaPrevista: addMoney(acc.receitaPrevista, r.receitaPrevista),
      receitaRealizada: addMoney(acc.receitaRealizada, r.receitaRealizada),
      variacaoReceita: addMoney(acc.variacaoReceita, r.variacaoReceita),
      despesaPrevista: addMoney(acc.despesaPrevista, r.despesaPrevista),
      despesaRealizada: addMoney(acc.despesaRealizada, r.despesaRealizada),
      variacaoDespesa: addMoney(acc.variacaoDespesa, r.variacaoDespesa),
      resultadoPrevisto: addMoney(acc.resultadoPrevisto, r.resultadoPrevisto),
      resultadoRealizado: addMoney(acc.resultadoRealizado, r.resultadoRealizado),
      variacaoResultado: addMoney(acc.variacaoResultado, r.variacaoResultado),
    }),
    {
      receitaPrevista: 0,
      receitaRealizada: 0,
      variacaoReceita: 0,
      despesaPrevista: 0,
      despesaRealizada: 0,
      variacaoDespesa: 0,
      resultadoPrevisto: 0,
      resultadoRealizado: 0,
      variacaoResultado: 0,
    }
  );

  return { rows, totais };
}
