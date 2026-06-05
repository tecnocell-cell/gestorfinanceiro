/**
 * Navegação Super Admin — ordem por frequência de uso no dia a dia.
 * Clientes → SaaS → Operações → Pagamentos → Homologação → Beta
 */
export const ADMIN_NAV = [
  {
    id: "admin-tenants",
    label: "Clientes / Tenants",
    sub: "Contas · planos · faturas",
    icon: "tenants",
  },
  {
    id: "admin-saas",
    label: "Gestão SaaS",
    sub: "MRR · alertas · cobrança",
    icon: "saas",
  },
  {
    id: "admin-operacoes",
    label: "Operações",
    sub: "Plataforma · suporte · WhatsApp",
    icon: "operacoes",
  },
  {
    id: "admin-pagamentos",
    label: "Config. Pagamento",
    sub: "Mercado Pago · Asaas",
    icon: "pagamentos",
  },
  {
    id: "admin-release",
    label: "Release Candidate",
    sub: "Checklist · PIX · go-live",
    icon: "release",
  },
  {
    id: "admin-guia",
    label: "Guia de Produção",
    sub: "Deploy · MP · e-mail",
    icon: "guia",
  },
  {
    id: "admin-homologacao-real",
    label: "Homologação Real",
    sub: "PF · PJ · pagamento · beta",
    icon: "homologacaoReal",
  },
  {
    id: "admin-homologacao",
    label: "Homologação",
    sub: "Produção · beta · logs",
    icon: "homologacao",
  },
  {
    id: "admin-beta",
    label: "Beta",
    sub: "Feedbacks · checklist · convite",
    icon: "beta",
  },
];

export const ADMIN_PAGE_IDS = ADMIN_NAV.map((n) => n.id);

/** Entrada padrão: gestão de clientes */
export const DEFAULT_ADMIN_PAGE = "admin-tenants";

export function isAdminPageId(page) {
  return ADMIN_PAGE_IDS.includes(page);
}

export function adminPageLabel(page) {
  return ADMIN_NAV.find((n) => n.id === page)?.label || "Painel Administrativo";
}
