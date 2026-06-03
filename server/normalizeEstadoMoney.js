/**
 * Normaliza campos monetários no estado (lançamentos, metas, orçamentos, contas).
 */
import { reaisFromCentavos } from './utils/money.js';

function round2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Number(x.toFixed(2));
}

/** Corrige drift clássico 4999,99 / 14999,98 quando centavos estão 1–2 abaixo do múltiplo de 100. */
export function fixValorFromCentavosDrift(valor) {
  const v = round2(valor);
  const cents = Math.round(Math.abs(v) * 100);
  const drift = cents % 100;
  if (drift >= 98) {
    const fixed = reaisFromCentavos(cents + (100 - drift));
    return v < 0 ? -fixed : fixed;
  }
  return v;
}

function normValorField(valor) {
  if (valor == null || valor === '') return valor;
  return fixValorFromCentavosDrift(round2(valor));
}

function normOrcamentoDimensao(o) {
  if (!o || typeof o !== 'object') return o;
  const out = { ...o };
  if (out.valorReceitaPrevista != null) {
    out.valorReceitaPrevista = normValorField(out.valorReceitaPrevista);
  }
  if (out.valorDespesaPrevista != null) {
    out.valorDespesaPrevista = normValorField(out.valorDespesaPrevista);
  }
  return out;
}

function normLancamento(l) {
  if (!l || typeof l !== 'object') return l;
  const out = { ...l };
  if (out.valor != null) out.valor = normValorField(out.valor);
  return out;
}

function normEmpresa(emp) {
  if (!emp) return emp;
  return {
    ...emp,
    lancamentos: (emp.lancamentos || []).map(normLancamento),
    metas: (emp.metas || []).map((m) =>
      m && m.valorAlvo != null
        ? { ...m, valorAlvo: normValorField(m.valorAlvo), valorAtual: normValorField(m.valorAtual ?? m.valorAtual) }
        : m
    ),
    orcamentos: (emp.orcamentos || []).map((o) =>
      o && o.valor != null ? { ...o, valor: normValorField(o.valor) } : o
    ),
    orcamentosCentros: (emp.orcamentosCentros || []).map(normOrcamentoDimensao),
    orcamentosProjetos: (emp.orcamentosProjetos || []).map(normOrcamentoDimensao),
    contas: (emp.contas || []).map((c) =>
      c && c.saldoInicial != null
        ? { ...c, saldoInicial: normValorField(c.saldoInicial) }
        : c
    ),
  };
}

export function normalizeMoneyInState(dados) {
  if (!dados || typeof dados !== 'object') return dados;
  const empresas = (dados.empresas || []).map(normEmpresa);
  const rootLanc = (dados.lancamentos || []).map(normLancamento);
  return {
    ...dados,
    empresas,
    ...(rootLanc.length ? { lancamentos: rootLanc } : {}),
  };
}
