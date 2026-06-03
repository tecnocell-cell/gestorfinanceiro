export const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Cores de gráfico — chart-1…5 do globals.css (vívidas) */
export const CHART = {
  grid: "oklch(0.925 0.004 150)",
  tick: "oklch(0.5 0.015 155)",
  receita: "oklch(0.42 0.08 155)",
  custo: "oklch(0.58 0.22 27)",
  despesas: "oklch(0.769 0.188 70.08)",
  lucro: "oklch(0.72 0.16 145)",
  lucroBruto: "oklch(0.6 0.118 184.704)",
  pie: [
    "oklch(0.42 0.08 155)",
    "oklch(0.6 0.118 184.704)",
    "oklch(0.398 0.07 227.392)",
    "oklch(0.72 0.12 80)",
    "oklch(0.769 0.188 70.08)",
  ],
};

export const STORAGE_KEY = "gestor_financeiro_v2";

/** Menu lateral PF — agrupado por seção (estilo Anatomia Financeira). */
export const NAV_SECTIONS_FISICA = [
  {
    section: "Principal",
    items: [{ id: "dashboard", label: "Dashboard" }],
  },
  {
    section: "Finanças",
    items: [
      { id: "lancamentos", label: "Lançamentos" },
      { id: "recorrencias", label: "Recorrências" },
      { id: "contas-pagar", label: "A Pagar/Receber" },
      { id: "resumo-anual", label: "Resumo Anual" },
    ],
  },
  {
    section: "Planejamento",
    items: [
      { id: "categorias", label: "Categorias" },
      { id: "orcamento", label: "Orçamento" },
      { id: "metas", label: "Metas" },
      { id: "resultado-centro-custo", label: "Centro de Custo" },
      { id: "projetos", label: "Projetos" },
      { id: "resultado-cliente", label: "Resultado Cliente" },
      { id: "resultado-projeto", label: "Resultado Projeto" },
      { id: "contas", label: "Contas" },
      { id: "relatorios", label: "Relatórios" },
    ],
  },
  {
    section: "Sistema",
    items: [
      { id: "whatsapp", label: "WhatsApp" },
      { id: "open-finance", label: "Conexões" },
      { id: "tutoriais", label: "Tutoriais" },
      { id: "suporte", label: "Suporte" },
      { id: "perfil", label: "Perfil" },
    ],
  },
];

/** Menu lateral PJ — agrupado por seção. */
export const NAV_SECTIONS_PJ = [
  {
    section: "Principal",
    items: [{ id: "dashboard", label: "Dashboard" }],
  },
  {
    section: "Finanças",
    items: [
      { id: "lancamentos", label: "Lançamentos" },
      { id: "recorrencias", label: "Recorrências" },
      { id: "contas-pagar", label: "A Pagar/Receber" },
      { id: "resumo-anual", label: "Resumo Anual" },
      { id: "dre", label: "D.R.E." },
      { id: "contas", label: "Contas" },
      { id: "plano", label: "Plano de Contas" },
      { id: "impostos", label: "Impostos" },
    ],
  },
  {
    section: "Operacional",
    items: [
      { id: "clientes", label: "Clientes" },
      { id: "projetos", label: "Projetos" },
      { id: "resultado-cliente", label: "Resultado Cliente" },
      { id: "resultado-projeto", label: "Resultado Projeto" },
      { id: "fornecedores", label: "Fornecedores" },
      { id: "importacoes", label: "Importações" },
      { id: "conciliacao", label: "Conciliação" },
      { id: "balancete", label: "Balancete" },
      { id: "fechamento", label: "Fechamento" },
      { id: "resultado-centro-custo", label: "Centro de Custo" },
      { id: "relatorios", label: "Relatórios" },
    ],
  },
  {
    section: "Sistema",
    items: [
      { id: "whatsapp", label: "WhatsApp" },
      { id: "integracao-pf-pj", label: "Integração PF/PJ" },
      { id: "open-finance", label: "Conexões" },
      { id: "tutoriais", label: "Tutoriais" },
      { id: "suporte", label: "Suporte" },
      { id: "empresa", label: "Empresa" },
    ],
  },
];

const flattenNav = (sections) => sections.flatMap((s) => s.items);

export const NAV_ITEMS_FISICA = flattenNav(NAV_SECTIONS_FISICA);
export const NAV_ITEMS = flattenNav(NAV_SECTIONS_PJ);
