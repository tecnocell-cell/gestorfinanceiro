/**
 * Categorias padrão sugeridas (Phase 5 — Fase 5).
 * Não incluem `id` — o caller deve adicionar via generateId().
 * `sistema: true` marca que veio do banco de sugestões.
 * Campos opcionais em planoContas: icone, cor, sistema.
 * Retrocompatível: lançamentos antigos ignoram esses campos.
 */

export const DEFAULT_CATS_PF = [
  // ── Despesas ────────────────────────────────────────────────────────────────
  { descricao: "Moradia",       tipo: "Despesa", icone: "🏠", cor: "oklch(0.55 0.17 240)", classificacao: "DESPESA", natureza: "Debito",  usarSaldo: true, sistema: true },
  { descricao: "Alimentação",   tipo: "Despesa", icone: "🍔", cor: "oklch(0.65 0.18 50)",  classificacao: "DESPESA", natureza: "Debito",  usarSaldo: true, sistema: true },
  { descricao: "Transporte",    tipo: "Despesa", icone: "🚗", cor: "oklch(0.50 0.13 230)", classificacao: "DESPESA", natureza: "Debito",  usarSaldo: true, sistema: true },
  { descricao: "Saúde",         tipo: "Despesa", icone: "💊", cor: "oklch(0.55 0.14 150)", classificacao: "DESPESA", natureza: "Debito",  usarSaldo: true, sistema: true },
  { descricao: "Educação",      tipo: "Despesa", icone: "📚", cor: "oklch(0.52 0.18 280)", classificacao: "DESPESA", natureza: "Debito",  usarSaldo: true, sistema: true },
  { descricao: "Lazer",         tipo: "Despesa", icone: "🎭", cor: "oklch(0.58 0.20 330)", classificacao: "DESPESA", natureza: "Debito",  usarSaldo: true, sistema: true },
  { descricao: "Vestuário",     tipo: "Despesa", icone: "👗", cor: "oklch(0.60 0.16 310)", classificacao: "DESPESA", natureza: "Debito",  usarSaldo: true, sistema: true },
  { descricao: "Serviços",      tipo: "Despesa", icone: "🔧", cor: "oklch(0.50 0.03 220)", classificacao: "DESPESA", natureza: "Debito",  usarSaldo: true, sistema: true },
  { descricao: "Assinaturas",   tipo: "Despesa", icone: "💻", cor: "oklch(0.55 0.17 240)", classificacao: "DESPESA", natureza: "Debito",  usarSaldo: true, sistema: true },
  { descricao: "Pets",          tipo: "Despesa", icone: "🐾", cor: "oklch(0.62 0.16 50)",  classificacao: "DESPESA", natureza: "Debito",  usarSaldo: true, sistema: true },
  { descricao: "Presentes",     tipo: "Despesa", icone: "🎁", cor: "oklch(0.58 0.20 330)", classificacao: "DESPESA", natureza: "Debito",  usarSaldo: true, sistema: true },
  { descricao: "Academia",      tipo: "Despesa", icone: "💪", cor: "oklch(0.65 0.18 50)",  classificacao: "DESPESA", natureza: "Debito",  usarSaldo: true, sistema: true },

  // ── Receitas ─────────────────────────────────────────────────────────────────
  { descricao: "Salário",       tipo: "Receita", icone: "💰", cor: "oklch(0.55 0.14 150)", classificacao: "RECEITA", natureza: "Credito", usarSaldo: true, sistema: true },
  { descricao: "Freelance",     tipo: "Receita", icone: "🤝", cor: "oklch(0.55 0.18 163)", classificacao: "RECEITA", natureza: "Credito", usarSaldo: true, sistema: true },
  { descricao: "Investimentos", tipo: "Receita", icone: "📈", cor: "oklch(0.52 0.17 240)", classificacao: "RECEITA", natureza: "Credito", usarSaldo: true, sistema: true },
  { descricao: "Outras Receitas", tipo: "Receita", icone: "💳", cor: "oklch(0.55 0.14 150)", classificacao: "RECEITA", natureza: "Credito", usarSaldo: true, sistema: true },
];

export const DEFAULT_CATS_PJ = [
  // ── Receitas ─────────────────────────────────────────────────────────────────
  { descricao: "Vendas de Produtos",  tipo: "Receita", icone: "📦", cor: "oklch(0.55 0.14 150)", classificacao: "RECEITA", natureza: "Credito", usarSaldo: true, sistema: true },
  { descricao: "Serviços Prestados",  tipo: "Receita", icone: "🤝", cor: "oklch(0.55 0.18 163)", classificacao: "RECEITA", natureza: "Credito", usarSaldo: true, sistema: true },
  { descricao: "Outras Receitas",     tipo: "Receita", icone: "💰", cor: "oklch(0.55 0.14 150)", classificacao: "RECEITA", natureza: "Credito", usarSaldo: true, sistema: true },

  // ── Custos ───────────────────────────────────────────────────────────────────
  { descricao: "Custo de Mercadoria", tipo: "Custo",   icone: "🛒", cor: "oklch(0.65 0.18 50)",  classificacao: "CUSTO",   natureza: "Debito",  usarSaldo: true, sistema: true },
  { descricao: "Custo de Serviços",   tipo: "Custo",   icone: "🔧", cor: "oklch(0.65 0.18 50)",  classificacao: "CUSTO",   natureza: "Debito",  usarSaldo: true, sistema: true },

  // ── Despesas ──────────────────────────────────────────────────────────────────
  { descricao: "Folha de Pagamento",  tipo: "Despesa", icone: "👥", cor: "oklch(0.58 0.22 27)",  classificacao: "DESPESA", natureza: "Debito",  usarSaldo: true, sistema: true },
  { descricao: "Aluguel",             tipo: "Despesa", icone: "🏠", cor: "oklch(0.50 0.03 220)", classificacao: "DESPESA", natureza: "Debito",  usarSaldo: true, sistema: true },
  { descricao: "Marketing",           tipo: "Despesa", icone: "📊", cor: "oklch(0.52 0.17 240)", classificacao: "DESPESA", natureza: "Debito",  usarSaldo: true, sistema: true },
  { descricao: "TI / Software",       tipo: "Despesa", icone: "💻", cor: "oklch(0.52 0.17 240)", classificacao: "DESPESA", natureza: "Debito",  usarSaldo: true, sistema: true },
  { descricao: "Energia / Água",      tipo: "Despesa", icone: "💡", cor: "oklch(0.70 0.15 75)",  classificacao: "DESPESA", natureza: "Debito",  usarSaldo: true, sistema: true },
  { descricao: "Logística",           tipo: "Despesa", icone: "✈️", cor: "oklch(0.50 0.03 220)", classificacao: "DESPESA", natureza: "Debito",  usarSaldo: true, sistema: true },

  // ── Impostos ──────────────────────────────────────────────────────────────────
  { descricao: "Simples Nacional",    tipo: "Imposto", icone: "📋", cor: "oklch(0.55 0.01 0)",   classificacao: "IMPOSTO", natureza: "Debito",  usarSaldo: true, sistema: true },
  { descricao: "IRPJ / CSLL",         tipo: "Imposto", icone: "🏦", cor: "oklch(0.55 0.01 0)",   classificacao: "IMPOSTO", natureza: "Debito",  usarSaldo: true, sistema: true },
];
