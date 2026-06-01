/**
 * Instituições financeiras para cadastro de contas (PF/PJ).
 */

export const BANCOS_CONTA = [
  { slug: "nubank",    nome: "Nubank",          sigla: "Nu",   cor: "oklch(0.52 0.22 295)", icone: "💜", tipoSugerido: "Banco" },
  { slug: "inter",     nome: "Banco Inter",     sigla: "Int",  cor: "oklch(0.62 0.18 52)",  icone: "🧡", tipoSugerido: "Banco" },
  { slug: "bradesco",  nome: "Bradesco",        sigla: "Bra",  cor: "oklch(0.50 0.22 27)",  icone: "🔴", tipoSugerido: "Banco" },
  { slug: "itau",      nome: "Itaú",            sigla: "Itaú", cor: "oklch(0.58 0.17 52)",  icone: "🟠", tipoSugerido: "Banco" },
  { slug: "bb",        nome: "Banco do Brasil", sigla: "BB",   cor: "oklch(0.63 0.14 82)",  icone: "💛", tipoSugerido: "Banco" },
  { slug: "caixa",     nome: "Caixa",           sigla: "CEF",  cor: "oklch(0.44 0.18 240)", icone: "🔵", tipoSugerido: "Banco" },
  { slug: "santander", nome: "Santander",       sigla: "San",  cor: "oklch(0.48 0.22 27)",  icone: "🔴", tipoSugerido: "Banco" },
  { slug: "sicredi",   nome: "Sicredi",         sigla: "Sic",  cor: "oklch(0.48 0.14 155)", icone: "🟢", tipoSugerido: "Banco" },
  { slug: "c6",        nome: "C6 Bank",         sigla: "C6",   cor: "oklch(0.28 0.02 0)",   icone: "⚫", tipoSugerido: "Banco" },
  { slug: "sicoob",    nome: "Sicoob",          sigla: "Scb",  cor: "oklch(0.52 0.16 155)", icone: "🟢", tipoSugerido: "Banco" },
  { slug: "xp",        nome: "XP",              sigla: "XP",   cor: "oklch(0.32 0.02 0)",   icone: "📈", tipoSugerido: "Investimento" },
  { slug: "mercadopago", nome: "Mercado Pago",  sigla: "MP",   cor: "oklch(0.55 0.15 230)", icone: "💙", tipoSugerido: "Banco" },
  { slug: "picpay",    nome: "PicPay",          sigla: "PP",   cor: "oklch(0.55 0.18 155)", icone: "💚", tipoSugerido: "Banco" },
  { slug: "pagbank",   nome: "PagBank",         sigla: "Pag",  cor: "oklch(0.55 0.16 155)", icone: "💚", tipoSugerido: "Banco" },
];

export const BANCOS_CONTA_DESTAQUE = ["nubank", "inter", "bradesco", "itau", "bb", "caixa"];

export const CONTA_PRESETS = [
  { slug: "carteira", nome: "Carteira / Dinheiro", sigla: "R$", cor: "oklch(0.55 0.14 150)", icone: "💵", tipoSugerido: "Caixa" },
  { slug: "poupanca", nome: "Poupança genérica",   sigla: "Pou", cor: "oklch(0.52 0.18 280)", icone: "🐷", tipoSugerido: "Poupança" },
  { slug: "outro",    nome: "Outra instituição",   sigla: "···", cor: "oklch(0.55 0.01 0)",   icone: "🏦", tipoSugerido: "Outros" },
];

export const CONTA_ICONES = [
  "💵", "🏦", "💳", "🐷", "📈", "💰", "🪙", "💎", "🏧", "📱",
  "💜", "🧡", "🔴", "🟠", "💛", "🔵", "🟢", "⚫", "💙", "💚",
];

const bySlug = new Map([
  ...BANCOS_CONTA.map((b) => [b.slug, b]),
  ...CONTA_PRESETS.map((b) => [b.slug, b]),
]);

export function getInstituicaoBySlug(slug) {
  if (!slug) return null;
  return bySlug.get(slug) || null;
}

export function labelInstituicaoConta(conta) {
  const inst = getInstituicaoBySlug(conta?.instituicao);
  if (inst) return inst.nome;
  if (conta?.tipo === "Caixa") return "Carteira";
  return conta?.apelido || "—";
}
