import { MESES } from "./constants.js";

export const generateId = () => Math.random().toString(36).slice(2, 11);

export const fmtBRL = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export const fmtPct = (v) => `${((v || 0) * 100).toFixed(1)}%`;

export const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
};

export const getSaldoConta = (contaId, contas, lancamentos) => {
  const conta = contas.find((c) => c.id === contaId);
  if (!conta) return 0;
  const entradas = lancamentos
    .filter((l) => l.contaEntradaId === contaId)
    .reduce((s, l) => s + l.valor, 0);
  const saidas = lancamentos
    .filter((l) => l.contaSaidaId === contaId)
    .reduce((s, l) => s + l.valor, 0);
  return (conta.saldoInicial || 0) + entradas - saidas;
};

export const getSaldoTotal = (contas, lancamentos) =>
  contas.filter((c) => !c.inativo).reduce((s, c) => s + getSaldoConta(c.id, contas, lancamentos), 0);

export const filterLancamentos = (lancamentos, { ano, mes, tipo, search, contaId, consiliado }) => {
  return lancamentos
    .filter((l) => {
      const date = new Date(l.data + "T00:00:00");
      const y = date.getFullYear().toString();
      const m = (date.getMonth() + 1).toString().padStart(2, "0");
      if (ano && y !== ano) return false;
      if (mes && m !== mes) return false;
      if (tipo && tipo !== "Todos" && l.tipo !== tipo) return false;
      if (consiliado === "Sim" && !l.consiliado) return false;
      if (consiliado === "Nao" && l.consiliado) return false;
      if (contaId && l.contaEntradaId !== contaId && l.contaSaidaId !== contaId) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !l.historico?.toLowerCase().includes(q) &&
          !l.lote?.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    })
    .sort((a, b) => new Date(a.data) - new Date(b.data) || a.id.localeCompare(b.id));
};

const periodStart = (ano, mes) => {
  if (!ano) return null;
  const m = mes ? parseInt(mes, 10) - 1 : 0;
  return new Date(parseInt(ano, 10), m, 1);
};

const inPeriod = (dataStr, ano, mes) => {
  const d = new Date(dataStr + "T00:00:00");
  if (ano && d.getFullYear().toString() !== ano) return false;
  if (mes && (d.getMonth() + 1).toString().padStart(2, "0") !== mes) return false;
  return true;
};

const movPlano = (lancamentos, planoId, opts = {}) => {
  const { before, ano, mes, from, to } = opts;
  return lancamentos
    .filter((l) => {
      if (l.planoId !== planoId) return false;
      if (from !== undefined) {
        // range mode
        if (before) return l.data < from;
        if (from && l.data < from) return false;
        if (to && l.data > to) return false;
        return true;
      }
      // period mode
      const d = new Date(l.data + "T00:00:00");
      if (before) {
        const start = periodStart(ano, mes);
        if (start && d >= start) return false;
        if (ano && !mes && d.getFullYear().toString() >= ano) return false;
      } else if (!inPeriod(l.data, ano, mes)) {
        return false;
      }
      return true;
    })
    .reduce(
      (acc, l) => {
        if (l.tipo === "Entrada") acc.entradas += l.valor;
        if (l.tipo === "Saida" || l.tipo === "Transferencia") acc.saidas += l.valor;
        return acc;
      },
      { entradas: 0, saidas: 0 }
    );
};

function computeDRE(resultado, planoContas) {
  const receitas = planoContas
    .filter((p) => p.tipo === "Receita")
    .reduce((s, p) => s + (resultado[p.id]?.entradas || 0), 0);
  const custos = planoContas
    .filter((p) => p.tipo === "Custo")
    .reduce((s, p) => s + (resultado[p.id]?.saidas || 0), 0);
  const despesas = planoContas
    .filter((p) => p.tipo === "Despesa")
    .reduce((s, p) => s + (resultado[p.id]?.saidas || 0), 0);
  const impostos = planoContas
    .filter((p) => p.tipo === "Imposto")
    .reduce((s, p) => s + (resultado[p.id]?.saidas || 0), 0);

  const lucroBruto = receitas - custos;
  const lucroLiquido = lucroBruto - despesas;
  const lucroAposImpostos = lucroLiquido - impostos;

  return {
    receitas,
    custos,
    despesas,
    impostos,
    lucroBruto,
    lucroLiquido,
    lucroAposImpostos,
    resultado,
    lucroPct: receitas > 0 ? lucroLiquido / receitas : 0,
    lucroAposImpPct: receitas > 0 ? lucroAposImpostos / receitas : 0,
  };
}

export const getDRE = (lancamentos, planoContas, ano, mes) => {
  const resultado = {};
  planoContas.forEach((pc) => {
    const { entradas, saidas } = movPlano(lancamentos, pc.id, { ano, mes });
    resultado[pc.id] = { entradas, saidas, saldo: entradas - saidas };
  });
  return computeDRE(resultado, planoContas);
};

export const getDREByRange = (lancamentos, planoContas, from, to) => {
  const resultado = {};
  planoContas.forEach((pc) => {
    const { entradas, saidas } = movPlano(lancamentos, pc.id, { from, to });
    resultado[pc.id] = { entradas, saidas, saldo: entradas - saidas };
  });
  return computeDRE(resultado, planoContas);
};

/** Consulta DRE estilo Excel (Consulta_DRE) */
export const getConsultaDRE = (lancamentos, planoContas, contas, ano, mes) =>
  planoContas
    .filter((pc) => !pc.inativo)
    .map((pc) => {
      const anterior = movPlano(lancamentos, pc.id, { before: true, ano, mes });
      const periodo = movPlano(lancamentos, pc.id, { ano, mes });
      const saldoAnterior =
        pc.tipo === "Receita"
          ? anterior.entradas - anterior.saidas
          : anterior.saidas - anterior.entradas;
      const { entradas, saidas } = periodo;
      const saldoAtual =
        pc.tipo === "Receita"
          ? saldoAnterior + entradas - saidas
          : saldoAnterior + saidas - entradas;

      const contasFin = contas
        .filter(
          (c) =>
            String(c.codigoClassificacao ?? "") === String(pc.codigo) ||
            c.classificacao === pc.classificacao
        )
        .map((c) => c.nome)
        .join(", ");

      return {
        id: pc.id,
        codigo: pc.codigo,
        classificacao: pc.classificacao,
        descricao: pc.descricao,
        tipo: pc.tipo,
        contaFinanceira: contasFin || pc.descricao,
        saldoAnterior,
        entradas,
        saidas,
        saldoAtual,
      };
    });

export const getConsultaDREByRange = (lancamentos, planoContas, contas, from, to) =>
  planoContas
    .filter((pc) => !pc.inativo)
    .map((pc) => {
      const anterior = movPlano(lancamentos, pc.id, { from, before: true });
      const periodo = movPlano(lancamentos, pc.id, { from, to });
      const saldoAnterior =
        pc.tipo === "Receita"
          ? anterior.entradas - anterior.saidas
          : anterior.saidas - anterior.entradas;
      const { entradas, saidas } = periodo;
      const saldoAtual =
        pc.tipo === "Receita"
          ? saldoAnterior + entradas - saidas
          : saldoAnterior + saidas - entradas;

      const contasFin = contas
        .filter(
          (c) =>
            String(c.codigoClassificacao ?? "") === String(pc.codigo) ||
            c.classificacao === pc.classificacao
        )
        .map((c) => c.nome)
        .join(", ");

      return {
        id: pc.id,
        codigo: pc.codigo,
        classificacao: pc.classificacao,
        descricao: pc.descricao,
        tipo: pc.tipo,
        contaFinanceira: contasFin || pc.descricao,
        saldoAnterior,
        entradas,
        saidas,
        saldoAtual,
      };
    });

export const contaPorCodigo = (contas, codigo) =>
  contas.find((c) => String(c.codigo) === String(codigo));

export const getMensal = (lancamentos, planoContas, ano) =>
  MESES.map((name, i) => {
    const mes = (i + 1).toString().padStart(2, "0");
    const dre = getDRE(lancamentos, planoContas, ano, mes);
    return {
      name,
      Receita: dre.receitas,
      Custo: dre.custos,
      Despesas: dre.despesas,
      Impostos: dre.impostos,
      "Lucro Líquido": dre.lucroLiquido,
      "Lucro %": dre.lucroPct,
    };
  });

export const getBalancete = (lancamentos, planoContas, contas, ano, mes) => {
  const dre = getDRE(lancamentos, planoContas, ano, mes);
  const linhas = planoContas.map((pc) => {
    const r = dre.resultado[pc.id] || { entradas: 0, saidas: 0 };
    const debito = pc.tipo === "Receita" ? 0 : r.saidas;
    const credito = pc.tipo === "Receita" ? r.entradas : 0;
    return {
      codigo: pc.codigo,
      descricao: pc.descricao,
      tipo: pc.tipo,
      debito,
      credito,
      saldo: credito - debito,
    };
  });

  const contasLinhas = contas
    .filter((c) => !c.inativo)
    .map((c) => ({
      codigo: c.codigo,
      descricao: c.nome,
      tipo: c.tipo,
      debito: 0,
      credito: 0,
      saldo: getSaldoConta(c.id, contas, lancamentos),
      isConta: true,
    }));

  return [...linhas, ...contasLinhas];
};

export const getFluxoCaixa = (lancamentos, ano, mes) => {
  const filtered = filterLancamentos(lancamentos, { ano, mes });
  let saldo = 0;
  return filtered.map((l) => {
    if (l.tipo !== "Transferencia") {
      saldo += l.tipo === "Entrada" ? l.valor : -l.valor;
    }
    return { ...l, saldoAcumulado: saldo };
  });
};

export const lancamentosComSaldoConta = (lancamentos, contas, contaId) => {
  const conta = contas.find((c) => c.id === contaId);
  if (!conta) return [];
  let saldo = conta.saldoInicial || 0;
  const sorted = filterLancamentos(lancamentos, { contaId });
  return sorted.map((l) => {
    if (l.contaEntradaId === contaId) saldo += l.valor;
    if (l.contaSaidaId === contaId) saldo -= l.valor;
    return { ...l, saldoConta: saldo };
  });
};

export const nextLote = (lancamentos) => {
  const nums = lancamentos
    .map((l) => parseInt(String(l.lote || "").replace(/\D/g, ""), 10))
    .filter((n) => !Number.isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `L${String(next).padStart(3, "0")}`;
};

/**
 * Computes the display status of a lançamento for Contas a Pagar/Receber.
 * "atrasado" is NEVER persisted — only computed here on the client.
 *  l.status:    "pendente" | "pago"  (undefined → "pago" fallback for old records)
 *  l.vencimento: optional date string (undefined → falls back to l.data)
 */
export const getStatusLancamento = (l) => {
  const s = l.status ?? "pago";
  if (s === "pago") return "pago";
  const hoje = new Date().toISOString().slice(0, 10);
  const venc = l.vencimento ?? l.data;
  return venc < hoje ? "atrasado" : "pendente";
};
