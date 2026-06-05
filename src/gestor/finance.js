import { MESES } from "./constants.js";
import {
  isLancamentoPago,
  getDataPagamento,
  getDataPrevista,
  getDataRealizacao,
  getStatusLancamentoDisplay,
  filterLancamentosRealizados,
  filterLancamentosPrevistos,
  normalizeLancamentoStatus,
  getValorRealizado,
  isLancamentoVencido,
  isLancamentoPendente,
} from "./financeStatus.js";

export {
  isLancamentoPago,
  getDataPagamento,
  getDataPrevista,
  getDataRealizacao,
  normalizeLancamentoStatus,
  getValorRealizado,
  isLancamentoVencido,
  isLancamentoPendente,
  filterLancamentosRealizados,
  filterLancamentosPrevistos,
} from "./financeStatus.js";

/** Converte centavos inteiros em reais sem erro de float (ex.: 1500000 → 15000). */
export function reaisFromCentavos(centavos) {
  const c = Math.round(Number(centavos));
  if (!Number.isFinite(c)) return 0;
  const neg = c < 0;
  const abs = Math.abs(c);
  const ints = Math.floor(abs / 100);
  const decs = abs % 100;
  const n = Number(`${ints}.${String(decs).padStart(2, "0")}`);
  return neg ? -n : n;
}

export const generateId = () => Math.random().toString(36).slice(2, 11);

/** Arredonda valor monetário para 2 casas (evita 999,99 em vez de 1.000,00 por float). */
export const roundMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(2));
};

/** Valor numérico seguro para cálculos e gráficos (NaN/inválido → fallback, sempre 2 casas). */
export const safeNum = (v, fallback = 0) => {
  if (v == null || v === "") return roundMoney(fallback);
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? roundMoney(n) : roundMoney(fallback);
};

/** Soma monetária com arredondamento a cada passo. */
export const addMoney = (...values) =>
  values.reduce((sum, v) => roundMoney(sum + safeNum(v)), 0);

/** Subtração monetária com arredondamento final. */
export const subMoney = (a, b) => roundMoney(safeNum(a) - safeNum(b));

export const fmtBRL = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(safeNum(v));

/** Converte entrada do usuário (15000, "15.000,00", etc.) em centavos inteiros. */
const emNDiasStr = (n, base) => {
  const ref = base ? new Date(base + "T00:00:00") : new Date();
  return new Date(ref.getTime() + n * 86_400_000).toISOString().slice(0, 10);
};

/** Fluxo previsto 30d: somente pendentes com vencimento/data nos próximos 30 dias. */
export function calcFluxoPrevisto30d(lancamentos, hoje) {
  const ref = hoje || new Date().toISOString().slice(0, 10);
  const ate = emNDiasStr(30, ref);
  return filterLancamentosPrevistos(lancamentos, { hoje: ref, ate }).reduce(
    (acc, l) => (l.tipo === "Entrada" ? addMoney(acc, l.valor) : subMoney(acc, l.valor)),
    0
  );
}

export function parseMoneyInputToCentavos(valor) {
  if (valor == null || valor === "") return null;

  let reais;
  if (typeof valor === "number" && Number.isFinite(valor)) {
    reais = Number(valor.toFixed(2));
  } else {
    let t = String(valor).trim().replace(/\s/g, "").replace(/^R\$/i, "");
    if (!t) return null;
    const lastComma = t.lastIndexOf(",");
    const lastDot = t.lastIndexOf(".");
    if (lastComma > -1 && lastDot > -1) {
      t = lastComma > lastDot
        ? t.replace(/\./g, "").replace(",", ".")
        : t.replace(/,/g, "");
    } else if (lastComma > -1) {
      t = t.replace(",", ".");
    } else if (lastDot > -1) {
      const parts = t.split(".");
      if (parts.length > 2) t = parts.join("");
    }
    const raw = parseFloat(t);
    if (!Number.isFinite(raw) || raw <= 0) return null;
    reais = Number(raw.toFixed(2));
  }

  const [intPart, decPart = "00"] = reais.toFixed(2).split(".");
  return parseInt(intPart, 10) * 100 + parseInt(decPart.slice(0, 2).padEnd(2, "0"), 10);
}

export const fmtPct = (v) => `${(safeNum(v) * 100).toFixed(1)}%`;

/** Normaliza DATE do Postgres (string ISO, Date ou YYYY-MM-DD). */
export const toDateKey = (d) => {
  if (!d) return "";
  if (typeof d === "string") {
    const m = d.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : "";
  }
  if (d instanceof Date && !Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return "";
};

export const fmtDate = (d) => {
  const key = toDateKey(d);
  if (!key) return "—";
  return new Date(key + "T00:00:00").toLocaleDateString("pt-BR");
};

/**
 * Formata ISO timestamp para "DD/MM/YYYY HH:mm".
 * Usado em lançamentos com createdAt (ex: origem WhatsApp).
 */
export const fmtDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

export const getSaldoConta = (contaId, contas, lancamentos) => {
  const conta = contas.find((c) => c.id === contaId);
  if (!conta) return 0;
  const entradas = lancamentos
    .filter((l) => l.contaEntradaId === contaId)
    .reduce((s, l) => addMoney(s, l.valor), 0);
  const saidas = lancamentos
    .filter((l) => l.contaSaidaId === contaId)
    .reduce((s, l) => addMoney(s, l.valor), 0);
  return addMoney(conta.saldoInicial, subMoney(entradas, saidas));
};

export const getSaldoTotal = (contas, lancamentos) =>
  contas
    .filter((c) => !c.inativo)
    .reduce((s, c) => addMoney(s, getSaldoConta(c.id, contas, lancamentos)), 0);

/** Categoria/discriminação exibida — usa plano do cadastro ou snapshot no lançamento. */
export const getPlanoLabelLancamento = (lanc, planoContas) => {
  const plano = (planoContas || []).find((p) => p.id === lanc.planoId);
  return plano?.descricao || lanc.planoDescricao || "";
};

export const getPlanoCodigoLancamento = (lanc, planoContas) => {
  const plano = (planoContas || []).find((p) => p.id === lanc.planoId);
  return plano?.codigo || lanc.planoCodigo || "";
};

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
    .sort((a, b) => {
      // Mais recente primeiro (data DESC).
      // Tiebreaker 1: codigo numérico mais recente primeiro.
      // Tiebreaker 2: createdAt mais recente (lançamentos WhatsApp têm timestamp completo).
      // Tiebreaker 3: id (estável).
      const aData = a.data || "1970-01-01";
      const bData = b.data || "1970-01-01";
      if (aData !== bData) return bData.localeCompare(aData);

      const aCod = Number(a.codigo);
      const bCod = Number(b.codigo);
      const aHasCod = Number.isFinite(aCod);
      const bHasCod = Number.isFinite(bCod);
      if (aHasCod && bHasCod && aCod !== bCod) return bCod - aCod;
      if (aHasCod && !bHasCod) return -1;
      if (!aHasCod && bHasCod) return 1;

      const aTs = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (aTs !== bTs) return bTs - aTs;

      return String(b.id || "").localeCompare(String(a.id || ""));
    });
};

const periodStart = (ano, mes) => {
  if (!ano) return null;
  const m = mes ? parseInt(mes, 10) - 1 : 0;
  return new Date(parseInt(ano, 10), m, 1);
};

const inPeriod = (dataStr, ano, mes) => {
  if (!dataStr) return false;
  const d = new Date(dataStr + "T00:00:00");
  if (ano && d.getFullYear().toString() !== ano) return false;
  if (mes && (d.getMonth() + 1).toString().padStart(2, "0") !== mes) return false;
  return true;
};

const movPlano = (lancamentos, planoId, opts = {}) => {
  const { before, ano, mes, from, to, modoCaixa = true } = opts;
  return lancamentos
    .filter((l) => {
      if (l.planoId !== planoId) return false;
      if (modoCaixa && !isLancamentoPago(l)) return false;
      const dataRef = modoCaixa ? (getDataRealizacao(l) || getDataPrevista(l)) : (getDataPrevista(l) || l.data);
      if (!dataRef) return false;
      if (from !== undefined) {
        if (before) return dataRef < from;
        if (from && dataRef < from) return false;
        if (to && dataRef > to) return false;
        return true;
      }
      const d = new Date(dataRef + "T00:00:00");
      if (before) {
        const start = periodStart(ano, mes);
        if (start && d >= start) return false;
        if (ano && !mes && d.getFullYear().toString() >= ano) return false;
      } else if (!inPeriod(dataRef, ano, mes)) {
        return false;
      }
      return true;
    })
    .reduce(
      (acc, l) => {
        if (l.tipo === "Entrada") acc.entradas = addMoney(acc.entradas, l.valor);
        if (l.tipo === "Saida" || l.tipo === "Transferencia") acc.saidas = addMoney(acc.saidas, l.valor);
        return acc;
      },
      { entradas: 0, saidas: 0 }
    );
};

function computeDRE(resultado, planoContas) {
  const receitas = planoContas
    .filter((p) => p.tipo === "Receita")
    .reduce((s, p) => addMoney(s, resultado[p.id]?.entradas || 0), 0);
  const custos = planoContas
    .filter((p) => p.tipo === "Custo")
    .reduce((s, p) => addMoney(s, resultado[p.id]?.saidas || 0), 0);
  const despesas = planoContas
    .filter((p) => p.tipo === "Despesa")
    .reduce((s, p) => addMoney(s, resultado[p.id]?.saidas || 0), 0);
  const impostos = planoContas
    .filter((p) => p.tipo === "Imposto")
    .reduce((s, p) => addMoney(s, resultado[p.id]?.saidas || 0), 0);

  const lucroBruto = subMoney(receitas, custos);
  const lucroLiquido = subMoney(lucroBruto, despesas);
  const lucroAposImpostos = subMoney(lucroLiquido, impostos);

  return {
    receitas,
    custos,
    despesas,
    impostos,
    lucroBruto,
    lucroLiquido,
    lucroAposImpostos,
    resultado,
    lucroPct: receitas > 0 ? roundMoney(lucroLiquido / receitas) : 0,
    lucroAposImpPct: receitas > 0 ? roundMoney(lucroAposImpostos / receitas) : 0,
  };
}

export const getDRE = (lancamentos, planoContas, ano, mes) => {
  const resultado = {};
  planoContas.forEach((pc) => {
    const { entradas, saidas } = movPlano(lancamentos, pc.id, { ano, mes });
    resultado[pc.id] = { entradas, saidas, saldo: subMoney(entradas, saidas) };
  });
  return computeDRE(resultado, planoContas);
};

export const getDREByRange = (lancamentos, planoContas, from, to) => {
  const resultado = {};
  planoContas.forEach((pc) => {
    const { entradas, saidas } = movPlano(lancamentos, pc.id, { from, to });
    resultado[pc.id] = { entradas, saidas, saldo: subMoney(entradas, saidas) };
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
          ? subMoney(anterior.entradas, anterior.saidas)
          : subMoney(anterior.saidas, anterior.entradas);
      const { entradas, saidas } = periodo;
      const saldoAtual =
        pc.tipo === "Receita"
          ? addMoney(saldoAnterior, subMoney(entradas, saidas))
          : addMoney(saldoAnterior, subMoney(saidas, entradas));

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
          ? subMoney(anterior.entradas, anterior.saidas)
          : subMoney(anterior.saidas, anterior.entradas);
      const { entradas, saidas } = periodo;
      const saldoAtual =
        pc.tipo === "Receita"
          ? addMoney(saldoAnterior, subMoney(entradas, saidas))
          : addMoney(saldoAnterior, subMoney(saidas, entradas));

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
      saldo: subMoney(credito, debito),
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
      saldo = l.tipo === "Entrada" ? addMoney(saldo, l.valor) : subMoney(saldo, l.valor);
    }
    return { ...l, saldoAcumulado: roundMoney(saldo) };
  });
};

export const lancamentosComSaldoConta = (lancamentos, contas, contaId) => {
  const conta = contas.find((c) => c.id === contaId);
  if (!conta) return [];
  // filterLancamentos retorna DESC. Para o saldo acumulado precisamos percorrer
  // em ordem cronológica (ASC), então invertemos, acumulamos e voltamos a DESC.
  const sortedDesc = filterLancamentos(lancamentos, { contaId });
  const sortedAsc = [...sortedDesc].reverse();
  let saldo = safeNum(conta.saldoInicial);
  const withSaldoAsc = sortedAsc.map((l) => {
    if (l.contaEntradaId === contaId) saldo = addMoney(saldo, l.valor);
    if (l.contaSaidaId === contaId) saldo = subMoney(saldo, l.valor);
    return { ...l, saldoConta: roundMoney(saldo) };
  });
  return withSaldoAsc.reverse();
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
 *
 * Priority:
 *  1. l.status ("pendente" | "pago") — set explicitly by ContasAPagarPage actions
 *  2. l.pago (boolean) — set by the modal form on create/edit
 *  3. Fallback: pendente (so new records always appear in "Em Aberto")
 *
 *  l.vencimento: optional date string (undefined → falls back to l.data)
 */
export const getStatusLancamento = (l) => {
  const hoje = new Date().toISOString().slice(0, 10);
  return getStatusLancamentoDisplay(l, hoje);
};
