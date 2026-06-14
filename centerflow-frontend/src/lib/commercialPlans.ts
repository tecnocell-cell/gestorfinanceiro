/**
 * Catálogo comercial Fluxiva — produto único, 4 planos.
 * Slugs internos legados (pf_*, pj_*) mantidos só para mapeamento de compatibilidade.
 */

export type CommercialPlanKey =
  | "FLUXIVA_LIGHT"
  | "FLUXIVA_START"
  | "FLUXIVA_PRO"
  | "FLUXIVA_BUSINESS";

export interface CommercialPlanDisplay {
  key: CommercialPlanKey;
  slug: string;
  name: string;
  price: string;
  tagline: string;
  users: string;
  numbers: string;
  ai: string;
  features: string[];
  notIncluded?: string[];
  highlight?: boolean;
}

/** Planos Fluxiva — exibição nas landing pages e checkout */
export const FLUXIVA_PLANS: CommercialPlanDisplay[] = [
  {
    key: "FLUXIVA_LIGHT",
    slug: "fluxiva_light",
    name: "Fluxiva Light",
    price: "R$ 19,90",
    tagline: "Para controlar sua vida financeira pessoal.",
    users: "1 usuário",
    numbers: "1 número WhatsApp",
    ai: "WhatsApp: lançamento por texto",
    features: [
      "1 ambiente pessoal",
      "Lançamentos ilimitados",
      "Categorias e metas",
      "Relatórios básicos",
      "Orçamento e extratos",
    ],
    notIncluded: [
      "Ambiente empresa",
      "DRE e centro de custo",
      "Múltiplos ambientes",
    ],
  },
  {
    key: "FLUXIVA_START",
    slug: "fluxiva_start",
    name: "Fluxiva Start",
    price: "R$ 29,90",
    tagline: "Pessoal e empresa na mesma conta.",
    users: "1 usuário",
    numbers: "1 número WhatsApp",
    ai: "WhatsApp: lançamento por texto",
    features: [
      "Ambiente pessoal",
      "Ambiente empresa",
      "Lançamentos ilimitados",
      "Categorias e orçamento",
      "Relatórios essenciais",
      "Repasses entre ambientes",
    ],
  },
  {
    key: "FLUXIVA_PRO",
    slug: "fluxiva_pro",
    name: "Fluxiva Pro",
    price: "R$ 79,90",
    tagline: "Agilidade e controle para equipes.",
    users: "Até 5 usuários",
    numbers: "Até 3 números WhatsApp",
    ai: "WhatsApp: texto e áudio",
    features: [
      "Até 5 ambientes",
      "Lançamentos ilimitados",
      "DRE e centro de custo",
      "Relatórios completos",
      "Repasses entre ambientes",
    ],
    highlight: true,
  },
  {
    key: "FLUXIVA_BUSINESS",
    slug: "fluxiva_business",
    name: "Fluxiva Business",
    price: "R$ 299,90",
    tagline: "Para empresas maiores e múltiplos negócios.",
    users: "Até 20 usuários",
    numbers: "Até 5 números WhatsApp",
    ai: "WhatsApp: texto, áudio e comprovante (IA)",
    features: [
      "Ambientes ilimitados",
      "Lançamentos ilimitados",
      "DRE completo e projetos financeiros",
      "IA completa e leitura de comprovantes",
      "Centro de custo avançado",
      "Repasses entre ambientes",
      "Suporte prioritário",
    ],
  },
];

export const COMMERCIAL_PLANS_BY_KEY: Record<CommercialPlanKey, CommercialPlanDisplay> =
  Object.fromEntries(FLUXIVA_PLANS.map((p) => [p.key, p])) as Record<
    CommercialPlanKey,
    CommercialPlanDisplay
  >;

/** Mapeamento legado slug → nome Fluxiva — mantido para compatibilidade */
export const LEGACY_SLUG_TO_NAME: Record<string, string> = {
  pf_basico:        "Fluxiva Light",
  pf_plus:          "Fluxiva Start",
  pf_premium:       "Fluxiva Pro",
  pj_start:         "Fluxiva Start",
  pj_pro:           "Fluxiva Pro",
  pj_business:      "Fluxiva Business",
  fluxiva_light:    "Fluxiva Light",
  fluxiva_start:    "Fluxiva Start",
  fluxiva_pro:      "Fluxiva Pro",
  fluxiva_business: "Fluxiva Business",
};
