/**
 * Textos dos planos comerciais — alinhados a Plano e Assinatura (gestor / API).
 * Slugs internos mantidos: pf_basico/pf_plus/pf_premium/pj_start/pj_pro/pj_business
 * Exibição unificada: Fluxiva Start / Fluxiva Pro / Fluxiva Business
 */

export type CommercialPlanKey =
  | "PF_BASIC"
  | "PF_PLUS"
  | "PF_PREMIUM"
  | "PJ_START"
  | "PJ_PRO"
  | "PJ_BUSINESS"
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
  highlight?: boolean;
}

/** Planos unificados Fluxiva — exibição nas landing pages */
export const FLUXIVA_PLANS: CommercialPlanDisplay[] = [
  {
    key: "FLUXIVA_START",
    slug: "pj_start",
    name: "Fluxiva Start",
    price: "R$ 29,90",
    tagline: "Organize suas finanças pessoais e da empresa.",
    users: "1 usuário na equipe",
    numbers: "1 número WhatsApp",
    ai: "WhatsApp: lançamento por texto",
    features: [
      "Ambientes Pessoal e Empresa",
      "Lançamentos ilimitados",
      "Metas e relatórios essenciais",
    ],
  },
  {
    key: "FLUXIVA_PRO",
    slug: "pj_pro",
    name: "Fluxiva Pro",
    price: "R$ 79,90",
    tagline: "Para quem quer mais agilidade e controle.",
    users: "Até 5 usuários na equipe",
    numbers: "3 números WhatsApp",
    ai: "WhatsApp: texto e áudio",
    features: [
      "Ambientes ilimitados",
      "Lançamentos ilimitados",
      "Centro de custo e DRE",
      "Relatórios completos",
      "Open Finance add-on (em breve)",
    ],
    highlight: true,
  },
  {
    key: "FLUXIVA_BUSINESS",
    slug: "pj_business",
    name: "Fluxiva Business",
    price: "R$ 199,90",
    tagline: "Para empresas e equipes exigentes.",
    users: "Até 20 usuários na equipe",
    numbers: "15 números WhatsApp",
    ai: "WhatsApp: texto, áudio e comprovante (IA)",
    features: [
      "Ambientes ilimitados",
      "Lançamentos ilimitados",
      "DRE completo e projetos financeiros",
      "Leitura de comprovante por IA",
      "Centro de custo avançado",
      "Suporte prioritário",
      "Open Finance add-on (em breve)",
    ],
  },
];

/** Mantidos para retrocompatibilidade com componentes antigos */
export const PF_COMMERCIAL_PLANS: CommercialPlanDisplay[] = [
  {
    key: "PF_BASIC",
    slug: "pf_basico",
    name: "Fluxiva Start",
    price: "R$ 19,90",
    tagline: "Para começar a organizar.",
    users: "1 usuário na equipe",
    numbers: "1 número WhatsApp",
    ai: "WhatsApp: lançamento por texto",
    features: [
      "Ambientes Pessoal e Empresa",
      "Lançamentos ilimitados",
      "Metas pessoais",
      "Relatórios essenciais",
    ],
  },
  {
    key: "PF_PLUS",
    slug: "pf_plus",
    name: "Fluxiva Pro",
    price: "R$ 29,90",
    tagline: "Mais agilidade no dia a dia.",
    users: "1 usuário na equipe",
    numbers: "3 números WhatsApp",
    ai: "WhatsApp: texto e áudio",
    features: [
      "Ambientes ilimitados",
      "Lançamentos ilimitados",
      "Relatórios completos",
      "Open Finance add-on (em breve)",
    ],
    highlight: true,
  },
  {
    key: "PF_PREMIUM",
    slug: "pf_premium",
    name: "Fluxiva Business",
    price: "R$ 49,90",
    tagline: "O financeiro completo.",
    users: "1 usuário na equipe",
    numbers: "5 números WhatsApp",
    ai: "WhatsApp: texto, áudio e comprovante",
    features: [
      "Ambientes ilimitados",
      "Lançamentos ilimitados",
      "Leitura de comprovante (IA)",
      "Suporte prioritário",
      "Open Finance add-on (em breve)",
    ],
  },
];

export const PJ_COMMERCIAL_PLANS: CommercialPlanDisplay[] = [
  {
    key: "PJ_START",
    slug: "pj_start",
    name: "Fluxiva Start",
    price: "R$ 59,90",
    tagline: "Para equipes pequenas.",
    users: "3 usuários na equipe",
    numbers: "2 números WhatsApp",
    ai: "WhatsApp: texto e áudio",
    features: [
      "Ambientes Pessoal e Empresa",
      "Lançamentos ilimitados",
      "Centro de custo",
      "DRE simplificado",
    ],
  },
  {
    key: "PJ_PRO",
    slug: "pj_pro",
    name: "Fluxiva Pro",
    price: "R$ 99,90",
    tagline: "Para empresas em crescimento.",
    users: "8 usuários na equipe",
    numbers: "5 números WhatsApp",
    ai: "WhatsApp: texto, áudio e comprovante",
    features: [
      "Ambientes ilimitados",
      "Lançamentos ilimitados",
      "Projetos financeiros",
      "DRE completo",
      "Centro de custo avançado",
      "Leitura de comprovante (IA)",
      "Open Finance add-on (em breve)",
    ],
    highlight: true,
  },
  {
    key: "PJ_BUSINESS",
    slug: "pj_business",
    name: "Fluxiva Business",
    price: "R$ 199,90",
    tagline: "Para empresas exigentes.",
    users: "20 usuários na equipe",
    numbers: "15 números WhatsApp",
    ai: "WhatsApp completo + IA",
    features: [
      "Ambientes ilimitados",
      "Lançamentos ilimitados",
      "Acesso API",
      "Suporte prioritário",
      "Projetos financeiros",
      "DRE completo",
      "Open Finance add-on (em breve)",
    ],
  },
];

export const COMMERCIAL_PLANS_BY_KEY: Record<string, CommercialPlanDisplay> =
  Object.fromEntries(
    [...FLUXIVA_PLANS, ...PF_COMMERCIAL_PLANS, ...PJ_COMMERCIAL_PLANS].map((p) => [p.key, p])
  ) as Record<string, CommercialPlanDisplay>;
