import { MESES } from "./constants.js";
import { addMoney, getDRE, getSaldoTotal, safeNum, subMoney, isLancamentoPago, getDataRealizacao } from "./finance.js";

/** SER / VBSP / GSC — metodologia inspirada em orçamento consciente (Anatomia Financeira). */
export function grupoResumoCategoria(pc) {
  const cls = (pc.classificacao || "").toUpperCase();
  const desc = (pc.descricao || "").toLowerCase();
  if (cls.includes("SER") || /invest|poupan|reserva|aplicac/.test(desc)) return "ser";
  if (cls.includes("GSC") || ["lazer", "vestuário", "vestuario"].includes(desc)) return "gsc";
  if (cls.includes("VBSP")) return "vbsp";
  if (pc.tipo === "Receita") return "receita";
  if (pc.tipo === "Despesa") return "vbsp";
  if (pc.tipo === "Custo" || pc.tipo === "Imposto") return "custo";
  return "outro";
}

const mesKey = (i) => (i + 1).toString().padStart(2, "0");

export function getSaldoContaAte(contaId, contas, lancamentos, ateData) {
  const conta = contas.find((c) => c.id === contaId);
  if (!conta || !ateData) return 0;
  let saldo = safeNum(conta.saldoInicial);
  for (const l of lancamentos) {
    if (!l.data || l.data > ateData) continue;
    if (l.contaEntradaId === contaId) saldo = addMoney(saldo, l.valor);
    if (l.contaSaidaId === contaId) saldo = subMoney(saldo, l.valor);
  }
  return saldo;
}

function lastDayOfMonth(ano, mesIndex) {
  return new Date(parseInt(ano, 10), mesIndex + 1, 0).toISOString().slice(0, 10);
}

function sumPlanoNoMes(lancamentos, planoId, ano, mesIndex, modo = "auto") {
  const mk = mesKey(mesIndex);
  return lancamentos
    .filter((l) => {
      if (l.planoId !== planoId) return false;
      if (!isLancamentoPago(l)) return false;
      const dataRef = getDataRealizacao(l);
      if (!dataRef) return false;
      const d = new Date(dataRef + "T00:00:00");
      if (d.getFullYear().toString() !== ano) return false;
      if ((d.getMonth() + 1).toString().padStart(2, "0") !== mk) return false;
      return true;
    })
    .reduce((s, l) => {
      if (modo === "entrada") return l.tipo === "Entrada" ? addMoney(s, l.valor) : s;
      if (modo === "saida") return l.tipo === "Saida" ? addMoney(s, l.valor) : s;
      if (l.tipo === "Entrada") return addMoney(s, l.valor);
      if (l.tipo === "Saida") return addMoney(s, l.valor);
      return s;
    }, 0);
}

function zeros12() {
  return Array.from({ length: 12 }, () => 0);
}

function filterLancamentosConta(lancamentos, contaId) {
  if (!contaId) return lancamentos;
  return lancamentos.filter(
    (l) => l.contaEntradaId === contaId || l.contaSaidaId === contaId
  );
}

/**
 * Matriz anual completa para PF ou PJ.
 */
export function buildResumoAnual({
  lancamentos,
  planoContas,
  contas,
  metas = [],
  ano,
  contaId = "",
  isPF = true,
}) {
  const lancs = filterLancamentosConta(lancamentos, contaId);
  const planos = planoContas.filter((p) => !p.inativo);

  const receitasPlano = planos.filter((p) => p.tipo === "Receita");
  const despesasPlano = planos.filter((p) => p.tipo === "Despesa");
  const custosPlano = planos.filter((p) => p.tipo === "Custo" || p.tipo === "Imposto");

  const vbspPlano = despesasPlano.filter((p) => grupoResumoCategoria(p) === "vbsp");
  const gscPlano = despesasPlano.filter((p) => grupoResumoCategoria(p) === "gsc");
  const serPlano = despesasPlano.filter((p) => grupoResumoCategoria(p) === "ser");

  const mapCategorias = (lista, modo = "auto") =>
    lista.map((pc) => ({
      id: pc.id,
      label: `${pc.icone ? pc.icone + " " : ""}${pc.descricao}`,
      meses: MESES.map((_, i) => sumPlanoNoMes(lancs, pc.id, ano, i, modo)),
    }));

  const somaMeses = (rows) =>
    MESES.map((_, mi) => rows.reduce((s, r) => addMoney(s, r.meses[mi] || 0), 0));

  const receitasRows = mapCategorias(receitasPlano, "entrada");
  const receitasTotais = somaMeses(receitasRows);

  const serRowsFromCats = mapCategorias(serPlano, "saida");
  const serRowsFromMetas = metas.map((m) => ({
    id: `meta-${m.id}`,
    label: m.descricao,
    meses: zeros12(),
    _meta: true,
  }));
  const serRows = [...serRowsFromMetas, ...serRowsFromCats];
  const serTotais = somaMeses(serRowsFromCats);

  const vbspRows = mapCategorias(vbspPlano.length ? vbspPlano : despesasPlano.filter((p) => grupoResumoCategoria(p) !== "gsc"), "saida");
  const vbspTotais = somaMeses(vbspRows);

  const gscRows = mapCategorias(gscPlano, "saida");
  const gscTotais = somaMeses(gscRows);

  const contasAtivas = contas.filter((c) => !c.inativo);
  const saldoContasRows = contasAtivas.map((c) => ({
    id: c.id,
    label: c.nome,
    meses: MESES.map((_, i) => getSaldoContaAte(c.id, contas, lancamentos, lastDayOfMonth(ano, i))),
  }));
  const saldoTotalMeses = MESES.map((_, i) =>
    contasAtivas.reduce(
      (s, c) => addMoney(s, getSaldoContaAte(c.id, contas, lancamentos, lastDayOfMonth(ano, i))),
      0
    )
  );

  const mensalDre = MESES.map((_, i) => getDRE(lancs, planoContas, ano, mesKey(i)));

  const receitaMeses = mensalDre.map((d) => d.receitas);
  const custoMeses = mensalDre.map((d) => addMoney(d.custos, d.impostos));
  const despesaMeses = mensalDre.map((d) => safeNum(d.despesas));
  const gastoVbspGsc = MESES.map((_, i) => addMoney(vbspTotais[i] || 0, gscTotais[i] || 0));
  const fechamentoMeses = MESES.map((_, i) =>
    subMoney(
      subMoney(receitaMeses[i], serTotais[i]),
      addMoney(gastoVbspGsc[i], isPF ? 0 : custoMeses[i])
    )
  );

  const anoReceita = receitaMeses.reduce((a, b) => addMoney(a, b), 0);
  const anoSer = serTotais.reduce((a, b) => addMoney(a, b), 0);
  const anoVbsp = vbspTotais.reduce((a, b) => addMoney(a, b), 0);
  const anoGsc = gscTotais.reduce((a, b) => addMoney(a, b), 0);
  const saldoAtual = getSaldoTotal(contas, lancamentos);

  let pjSections = null;
  if (!isPF) {
    const custoRows = mapCategorias(custosPlano, "saida");
    const despRows = mapCategorias(despesasPlano, "saida");
    pjSections = {
      custos: { rows: custoRows, totais: somaMeses(custoRows) },
      despesas: { rows: despRows, totais: somaMeses(despRows) },
      lucroMeses: mensalDre.map((d) => d.lucroAposImpostos ?? d.lucroLiquido),
    };
  }

  return {
    ano,
    kpis: {
      receita: anoReceita,
      ser: anoSer,
      vbsp: anoVbsp,
      gsc: anoGsc,
      saldoAtual,
    },
    saldoContas: { rows: saldoContasRows, totais: saldoTotalMeses },
    receitas: { rows: receitasRows, totais: receitasTotais },
    ser: { rows: serRows, totais: serTotais },
    vbsp: { rows: vbspRows, totais: vbspTotais },
    gsc: { rows: gscRows, totais: gscTotais },
    resumo: {
      receitaMeses,
      serMeses: serTotais,
      vbspMeses: vbspTotais,
      gscMeses: gscTotais,
      gastoTotalMeses: isPF ? gastoVbspGsc : despesaMeses.map((d, i) => addMoney(d, custoMeses[i])),
      fechamentoMeses,
      saldoContaMeses: saldoTotalMeses,
      saldoProjetadoMeses: saldoTotalMeses.map((s, i) => addMoney(s, fechamentoMeses[i])),
    },
    pjSections,
  };
}
