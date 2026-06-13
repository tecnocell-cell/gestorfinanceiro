/** Rótulos de operações PJ → PF (integração) — PJ e PF. */

export const SOURCE_INTEGRACAO_PF_PJ = "integracao_pf_pj";

export const INTEGRACAO_TIPO_OPERACAO_LABELS = {
  pro_labore: "Pró-labore",
  distribuicao_lucros: "Distribuição de lucros",
  salario: "Salário",
  transferencia_pj_pf: "Transferência Empresa → Pessoal",
};

/** Rótulo curto para badges em tabelas estreitas. */
export const INTEGRACAO_TIPO_OPERACAO_LABELS_SHORT = {
  pro_labore: "Pró-labore",
  distribuicao_lucros: "Lucros",
  salario: "Salário",
  transferencia_pj_pf: "Transf. Empresa→Pessoal",
};

export function getIntegracaoOperacaoLabel(lanc, { short = false } = {}) {
  if (String(lanc?.source || "") !== SOURCE_INTEGRACAO_PF_PJ) return "";

  const labels = short ? INTEGRACAO_TIPO_OPERACAO_LABELS_SHORT : INTEGRACAO_TIPO_OPERACAO_LABELS;
  const tipo = lanc.tipoOperacao || lanc.integracaoPfPj?.tipoOperacao;
  if (tipo && labels[tipo]) return labels[tipo];

  const h = String(lanc.historico || lanc.descricao || "").toLowerCase();
  if (/pr[oó][\s-]?labore/.test(h)) return labels.pro_labore;
  if (/sal[aá]rio/.test(h)) return labels.salario;
  if (/lucro|distribui/.test(h)) return labels.distribuicao_lucros;
  if (/transfer/.test(h)) return labels.transferencia_pj_pf;

  return short ? "Repasse" : "Repasse Empresa → Pessoal";
}

export function isLancamentoIntegracaoPfPj(lanc) {
  return String(lanc?.source || "") === SOURCE_INTEGRACAO_PF_PJ;
}
