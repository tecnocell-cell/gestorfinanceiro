/** Rótulos e opções por tipo de perfil (PF ≠ PJ). Valores internos permanecem Entrada/Saida/Transferencia. */

export const LANCAMENTO_TIPOS = ["Entrada", "Saida", "Transferencia"];

export const LANCAMENTO_FILTER_OPTIONS = ["Todos", ...LANCAMENTO_TIPOS];

const PF_LABELS = {
  Entrada: "Receita",
  Saida: "Despesa",
  Transferencia: "Transferência",
};

const PJ_LABELS = {
  Entrada: "Entrada",
  Saida: "Saída",
  Transferencia: "Transferência",
};

export function isPerfilFisica(tipo) {
  return tipo === "fisica";
}

export function labelLancamentoTipo(tipo, isPF) {
  const map = isPF ? PF_LABELS : PJ_LABELS;
  return map[tipo] || tipo;
}

export function labelFilterChip(filter, isPF) {
  if (filter === "Todos") return "Todos";
  if (isPF && filter === "Entrada") return "Receitas";
  if (isPF && filter === "Saida") return "Despesas";
  if (isPF && filter === "Transferencia") return "Transferências";
  return labelLancamentoTipo(filter, false);
}

export function lancamentoTipoOptions(isPF) {
  return LANCAMENTO_TIPOS.map((value) => ({
    value,
    label: labelLancamentoTipo(value, isPF),
  }));
}

export function contaFieldLabels(isPF) {
  if (isPF) {
    return {
      section: "Conta",
      entrada: "Conta",
      saida: "Conta",
      origem: "Conta origem",
      destino: "Conta destino",
    };
  }
  return {
    section: "Contas Financeiras",
    entrada: "Conta de Entrada",
    saida: "Conta de Saída",
    origem: "Conta de Entrada",
    destino: "Conta de Saída",
  };
}

export function resolveProfileTipo({ user, impersonatingUser, empresaTipo }) {
  return impersonatingUser?.tipo_perfil ?? user?.tipo_perfil ?? empresaTipo ?? "juridica";
}
