/** Rótulos de operações PJ → PF (integração) — PJ e PF. */

export const SOURCE_INTEGRACAO_PF_PJ = "integracao_pf_pj";

export const INTEGRACAO_TIPO_OPERACAO_LABELS = {
  pro_labore: "Pró-labore",
  distribuicao_lucros: "Distribuição de lucros",
  salario: "Salário",
  transferencia_pj_pf: "Transferência PJ → PF",
};

export function getIntegracaoOperacaoLabel(lanc) {
  if (String(lanc?.source || "") !== SOURCE_INTEGRACAO_PF_PJ) return "";

  const tipo = lanc.tipoOperacao || lanc.integracaoPfPj?.tipoOperacao;
  if (tipo && INTEGRACAO_TIPO_OPERACAO_LABELS[tipo]) {
    return INTEGRACAO_TIPO_OPERACAO_LABELS[tipo];
  }

  const h = String(lanc.historico || lanc.descricao || "").toLowerCase();
  if (/pr[oó][\s-]?labore/.test(h)) return INTEGRACAO_TIPO_OPERACAO_LABELS.pro_labore;
  if (/sal[aá]rio/.test(h)) return INTEGRACAO_TIPO_OPERACAO_LABELS.salario;
  if (/lucro|distribui/.test(h)) return INTEGRACAO_TIPO_OPERACAO_LABELS.distribuicao_lucros;
  if (/transfer/.test(h)) return INTEGRACAO_TIPO_OPERACAO_LABELS.transferencia_pj_pf;

  return "Integração PJ → PF";
}

export function isLancamentoIntegracaoPfPj(lanc) {
  return String(lanc?.source || "") === SOURCE_INTEGRACAO_PF_PJ;
}
