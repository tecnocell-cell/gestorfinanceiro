/**
 * Catálogo comercial unificado Fluxiva — 4 planos definitivos.
 * Slugs legados (pf_*, pj_*) mantidos apenas para compatibilidade no servidor.
 */
export type PlanSlug =
  | "fluxiva_light"
  | "fluxiva_start"
  | "fluxiva_pro"
  | "fluxiva_business";

export type PlanCatalogEntry = {
  slug: PlanSlug;
  nome: string;
  precoCentavos: number;
  limiteUsuarios: number;
  limiteWhatsappNumeros: number;
  whatsappTexto: boolean;
  whatsappAudio: boolean;
  whatsappComprovante: boolean;
};

export const PLAN_CATALOG_LANDING: PlanCatalogEntry[] = [
  {
    slug: "fluxiva_light",
    nome: "Fluxiva Light",
    precoCentavos: 1990,
    limiteUsuarios: 1,
    limiteWhatsappNumeros: 1,
    whatsappTexto: true,
    whatsappAudio: false,
    whatsappComprovante: false,
  },
  {
    slug: "fluxiva_start",
    nome: "Fluxiva Start",
    precoCentavos: 2990,
    limiteUsuarios: 1,
    limiteWhatsappNumeros: 1,
    whatsappTexto: true,
    whatsappAudio: false,
    whatsappComprovante: false,
  },
  {
    slug: "fluxiva_pro",
    nome: "Fluxiva Pro",
    precoCentavos: 7990,
    limiteUsuarios: 5,
    limiteWhatsappNumeros: 3,
    whatsappTexto: true,
    whatsappAudio: true,
    whatsappComprovante: false,
  },
  {
    slug: "fluxiva_business",
    nome: "Fluxiva Business",
    precoCentavos: 29990,
    limiteUsuarios: 20,
    limiteWhatsappNumeros: 5,
    whatsappTexto: true,
    whatsappAudio: true,
    whatsappComprovante: true,
  },
];

export const PLAN_BY_SLUG = Object.fromEntries(
  PLAN_CATALOG_LANDING.map((p) => [p.slug, p])
) as Record<PlanSlug, PlanCatalogEntry>;
