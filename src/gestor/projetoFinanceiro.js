/**
 * Projetos financeiros — associados a clientes (estado projetos[]).
 */
import { generateId, toDateKey } from "./finance.js";
import {
  accumulateResultadoPorCampo,
  finalizeResultadoRows,
} from "./resultadoFinanceiro.js";

export const PROJETO_STATUS = {
  ATIVO: "ativo",
  INATIVO: "inativo",
};

export function createProjeto({
  nome,
  clienteId = null,
  descricao = "",
  dataInicio = "",
  dataFim = "",
}) {
  return {
    id: generateId(),
    nome: String(nome || "").trim(),
    clienteId: clienteId || null,
    descricao: String(descricao || "").trim(),
    status: PROJETO_STATUS.ATIVO,
    dataInicio: toDateKey(dataInicio) || "",
    dataFim: toDateKey(dataFim) || "",
  };
}

export function projetosAtivos(projetos) {
  return (projetos || []).filter((p) => p.status === PROJETO_STATUS.ATIVO);
}

export function getProjetoLabel(projetos, projetoId) {
  if (!projetoId) return "Sem projeto";
  const p = (projetos || []).find((x) => x.id === projetoId);
  return p?.nome || "Projeto removido";
}

export function getClienteLabel(clientes, clienteId) {
  if (!clienteId) return "Sem cliente";
  const c = (clientes || []).find((x) => x.id === clienteId);
  return c?.nome || "Cliente removido";
}

export function getResultadoPorCliente(
  lancamentos,
  planoContas,
  clientes,
  { ano, mes, isPF = false } = {}
) {
  const buckets = accumulateResultadoPorCampo(lancamentos, planoContas, "clienteId", {
    ano,
    mes,
    isPF,
  });
  const nomeById = new Map((clientes || []).map((c) => [c.id, c.nome]));

  return finalizeResultadoRows(buckets, {
    idField: "clienteId",
    semLabel: "Sem cliente",
    nomeResolver: (id) => nomeById.get(id) || "Cliente removido",
    statusResolver: null,
  });
}

export function getResultadoPorProjeto(
  lancamentos,
  planoContas,
  projetos,
  clientes,
  { ano, mes, isPF = false } = {}
) {
  const buckets = accumulateResultadoPorCampo(lancamentos, planoContas, "projetoId", {
    ano,
    mes,
    isPF,
  });
  const nomeById = new Map((projetos || []).map((p) => [p.id, p.nome]));
  const statusById = new Map((projetos || []).map((p) => [p.id, p.status]));
  const clienteByProjeto = new Map((projetos || []).map((p) => [p.id, p.clienteId]));
  const clienteNome = new Map((clientes || []).map((c) => [c.id, c.nome]));

  return finalizeResultadoRows(buckets, {
    idField: "projetoId",
    semLabel: "Sem projeto",
    nomeResolver: (id) => nomeById.get(id) || "Projeto removido",
    statusResolver: (id) => statusById.get(id) || "inativo",
    extraFields: (id) => {
      if (!id) return { clienteNome: null };
      const cid = clienteByProjeto.get(id);
      return {
        clienteNome: cid ? clienteNome.get(cid) || "—" : "—",
      };
    },
  });
}
