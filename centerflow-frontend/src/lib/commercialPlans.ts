/**
 * Textos dos planos comerciais — alinhados a Plano e Assinatura (gestor / API).
 * Slugs: pf_basico, pf_plus, pf_premium, pj_start, pj_pro, pj_business
 */

export type CommercialPlanKey =
  | "PF_BASIC"
  | "PF_PLUS"
  | "PF_PREMIUM"
  | "PJ_START"
  | "PJ_PRO"
  | "PJ_BUSINESS";

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

export const PF_COMMERCIAL_PLANS: CommercialPlanDisplay[] = [
  {
    key: "PF_BASIC",
    slug: "pf_basico",
    name: "PF Básico",
    price: "R$ 19,90",
    tagline: "Para começar a organizar.",
    users: "1 usuário na equipe",
    numbers: "1 número WhatsApp",
    ai: "WhatsApp: lançamento por texto",
    features: [
      "Lançamentos ilimitados",
      "Metas pessoais",
      "Relatórios essenciais",
    ],
  },
  {
    key: "PF_PLUS",
    slug: "pf_plus",
    name: "PF Plus",
    price: "R$ 29,90",
    tagline: "Mais agilidade no dia a dia.",
    users: "1 usuário na equipe",
    numbers: "3 números WhatsApp",
    ai: "WhatsApp: texto e áudio",
    features: [
      "Lançamentos ilimitados",
      "Relatórios completos",
      "Open Finance add-on (em breve)",
    ],
    highlight: true,
  },
  {
    key: "PF_PREMIUM",
    slug: "pf_premium",
    name: "PF Premium",
    price: "R$ 49,90",
    tagline: "O financeiro completo.",
    users: "1 usuário na equipe",
    numbers: "5 números WhatsApp",
    ai: "WhatsApp: texto, áudio e comprovante",
    features: [
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
    name: "PJ Start",
    price: "R$ 59,90",
    tagline: "Para equipes pequenas.",
    users: "3 usuários na equipe",
    numbers: "2 números WhatsApp",
    ai: "WhatsApp: texto e áudio",
    features: [
      "Lançamentos ilimitados",
      "Centro de custo",
      "DRE simplificado",
      "Integração PF/PJ",
    ],
  },
  {
    key: "PJ_PRO",
    slug: "pj_pro",
    name: "PJ Pro",
    price: "R$ 99,90",
    tagline: "Para empresas em crescimento.",
    users: "8 usuários na equipe",
    numbers: "5 números WhatsApp",
    ai: "WhatsApp: texto, áudio e comprovante",
    features: [
      "Lançamentos ilimitados",
      "Projetos financeiros",
      "DRE completo",
      "Centro de custo avançado",
      "Leitura de comprovante (IA)",
      "Integração PF/PJ",
      "Open Finance add-on (em breve)",
    ],
    highlight: true,
  },
  {
    key: "PJ_BUSINESS",
    slug: "pj_business",
    name: "PJ Business",
    price: "R$ 199,90",
    tagline: "Para empresas exigentes.",
    users: "20 usuários na equipe",
    numbers: "15 números WhatsApp",
    ai: "WhatsApp completo + IA",
    features: [
      "Lançamentos ilimitados",
      "Acesso API",
      "Suporte prioritário",
      "Projetos financeiros",
      "DRE completo",
      "Integração PF/PJ",
      "Open Finance add-on (em breve)",
    ],
  },
];

export const COMMERCIAL_PLANS_BY_KEY: Record<CommercialPlanKey, CommercialPlanDisplay> =
  Object.fromEntries(
    [...PF_COMMERCIAL_PLANS, ...PJ_COMMERCIAL_PLANS].map((p) => [p.key, p])
  ) as Record<CommercialPlanKey, CommercialPlanDisplay>;
