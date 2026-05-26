export const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Cores de gráfico — tokens chart-1…5 do globals.css (OKLCH) */
export const CHART = {
  grid: "oklch(0.925 0.004 150)",
  tick: "oklch(0.5 0.015 155)",
  receita: "oklch(0.42 0.08 155)",
  custo: "oklch(0.58 0.22 27)",
  despesas: "oklch(0.70 0.15 75)",
  lucro: "oklch(0.72 0.16 145)",
  lucroBruto: "oklch(0.60 0.13 230)",
  pie: [
    "oklch(0.42 0.08 155)",
    "oklch(0.6 0.118 184.704)",
    "oklch(0.398 0.07 227.392)",
    "oklch(0.72 0.12 80)",
    "oklch(0.769 0.188 70.08)",
  ],
};

export const STORAGE_KEY = "gestor_financeiro_v2";

export const NAV_ITEMS_FISICA = [
  { id: "dashboard",    icon: "◉", label: "Dashboard"        },
  { id: "lancamentos",  icon: "↔", label: "Lançamentos"      },
  { id: "recorrencias", icon: "↺", label: "Recorrências"     },
  { id: "contas-pagar", icon: "⊖", label: "A Pagar/Receber"  },
  { id: "categorias",   icon: "▤", label: "Categorias"       },
  { id: "orcamento",    icon: "◎", label: "Orçamento"      },
  { id: "metas",        icon: "◈", label: "Metas"          },
  { id: "contas",       icon: "▦", label: "Contas"         },
  { id: "relatorios",   icon: "▥", label: "Relatórios"     },
  { id: "perfil",       icon: "⚙", label: "Perfil"         },
];

export const NAV_ITEMS = [
  { id: "dashboard",    icon: "◉", label: "Dashboard"        },
  { id: "lancamentos",  icon: "↔", label: "Lançamentos"      },
  { id: "recorrencias", icon: "↺", label: "Recorrências"     },
  { id: "contas-pagar", icon: "⊖", label: "A Pagar/Receber"  },
  { id: "dre",          icon: "▤", label: "D.R.E."           },
  { id: "contas",       icon: "◎", label: "Contas"         },
  { id: "plano",        icon: "▦", label: "Plano Contas"   },
  { id: "impostos",     icon: "%", label: "Impostos"       },
  { id: "clientes",     icon: "◐", label: "Clientes"       },
  { id: "fornecedores", icon: "◑", label: "Fornecedores"   },
  { id: "importacoes",  icon: "⇪", label: "Importações"    },
  { id: "conciliacao",  icon: "≈", label: "Conciliação"    },
  { id: "balancete",    icon: "☰", label: "Balancete"      },
  { id: "fechamento",   icon: "⊛", label: "Fechamento"     },
  { id: "relatorios",   icon: "▥", label: "Relatórios"     },
  { id: "empresa",      icon: "⚙", label: "Empresa"        },
];
