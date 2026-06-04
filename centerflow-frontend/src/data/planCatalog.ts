/**
 * Catálogo comercial — manter alinhado com server/billing/planRules.js (Etapa 7.2)
 */
export type PlanSlug =
  | "pf_basico"
  | "pf_plus"
  | "pf_premium"
  | "pj_start"
  | "pj_pro"
  | "pj_business";

export type PlanCatalogEntry = {
  slug: PlanSlug;
  nome: string;
  precoCentavos: number;
  segmento: "pf" | "pj";
  limiteUsuarios: number;
  limiteWhatsappNumeros: number;
  whatsappTexto: boolean;
  whatsappAudio: boolean;
  whatsappComprovante: boolean;
};

export const PLAN_CATALOG_LANDING: PlanCatalogEntry[] = [
  {
    slug: "pf_basico",
    nome: "PF Básico",
    precoCentavos: 1990,
    segmento: "pf",
    limiteUsuarios: 1,
    limiteWhatsappNumeros: 1,
    whatsappTexto: true,
    whatsappAudio: false,
    whatsappComprovante: false,
  },
  {
    slug: "pf_plus",
    nome: "PF Plus",
    precoCentavos: 2990,
    segmento: "pf",
    limiteUsuarios: 1,
    limiteWhatsappNumeros: 3,
    whatsappTexto: true,
    whatsappAudio: true,
    whatsappComprovante: false,
  },
  {
    slug: "pf_premium",
    nome: "PF Premium",
    precoCentavos: 4990,
    segmento: "pf",
    limiteUsuarios: 1,
    limiteWhatsappNumeros: 5,
    whatsappTexto: true,
    whatsappAudio: true,
    whatsappComprovante: true,
  },
  {
    slug: "pj_start",
    nome: "PJ Start",
    precoCentavos: 5990,
    segmento: "pj",
    limiteUsuarios: 3,
    limiteWhatsappNumeros: 2,
    whatsappTexto: true,
    whatsappAudio: true,
    whatsappComprovante: false,
  },
  {
    slug: "pj_pro",
    nome: "PJ Pro",
    precoCentavos: 9990,
    segmento: "pj",
    limiteUsuarios: 8,
    limiteWhatsappNumeros: 5,
    whatsappTexto: true,
    whatsappAudio: true,
    whatsappComprovante: true,
  },
  {
    slug: "pj_business",
    nome: "PJ Business",
    precoCentavos: 19990,
    segmento: "pj",
    limiteUsuarios: 20,
    limiteWhatsappNumeros: 15,
    whatsappTexto: true,
    whatsappAudio: true,
    whatsappComprovante: true,
  },
];

export const PLAN_BY_SLUG = Object.fromEntries(
  PLAN_CATALOG_LANDING.map((p) => [p.slug, p])
) as Record<PlanSlug, PlanCatalogEntry>;
