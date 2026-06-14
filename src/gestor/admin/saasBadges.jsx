const PLAN_STYLES = {
  // Legados — mapeados para nome Fluxiva
  pf_basico:        { label: "Fluxiva Light",    className: "saas-badge-plan saas-badge-plan--gray" },
  pf_plus:          { label: "Fluxiva Start",    className: "saas-badge-plan saas-badge-plan--blue" },
  pf_premium:       { label: "Fluxiva Pro",      className: "saas-badge-plan saas-badge-plan--orange" },
  pj_start:         { label: "Fluxiva Start",    className: "saas-badge-plan saas-badge-plan--green" },
  pj_pro:           { label: "Fluxiva Pro",      className: "saas-badge-plan saas-badge-plan--orange" },
  pj_business:      { label: "Fluxiva Business", className: "saas-badge-plan saas-badge-plan--gold" },
  // Catálogo Fluxiva definitivo
  fluxiva_light:    { label: "Fluxiva Light",    className: "saas-badge-plan saas-badge-plan--gray" },
  fluxiva_start:    { label: "Fluxiva Start",    className: "saas-badge-plan saas-badge-plan--green" },
  fluxiva_pro:      { label: "Fluxiva Pro",      className: "saas-badge-plan saas-badge-plan--orange" },
  fluxiva_business: { label: "Fluxiva Business", className: "saas-badge-plan saas-badge-plan--gold" },
};

const STATUS_STYLES = {
  trial: { label: "Trial", className: "saas-badge-status saas-badge-status--trial" },
  ativa: { label: "Ativa", className: "saas-badge-status saas-badge-status--ativa" },
  atrasada: { label: "Atrasada", className: "saas-badge-status saas-badge-status--atrasada" },
  vencida: { label: "Vencida", className: "saas-badge-status saas-badge-status--vencida" },
  cancelada: { label: "Cancelada", className: "saas-badge-status saas-badge-status--cancelada" },
};

export function PlanBadge({ slug, nome }) {
  const meta = PLAN_STYLES[slug] || { label: nome || slug || "—", className: "saas-badge-plan saas-badge-plan--gray" };
  return <span className={meta.className}>{meta.label}</span>;
}

export function SubscriptionStatusBadge({ status }) {
  const key = String(status || "").toLowerCase();
  const meta = STATUS_STYLES[key] || { label: status || "—", className: "saas-badge-status" };
  return <span className={meta.className}>{meta.label}</span>;
}

/** Planos Fluxiva — catálogo unificado para selects de admin */
export const FLUXIVA_PLAN_OPTIONS = [
  { slug: "fluxiva_light",    label: "Fluxiva Light" },
  { slug: "fluxiva_start",    label: "Fluxiva Start" },
  { slug: "fluxiva_pro",      label: "Fluxiva Pro" },
  { slug: "fluxiva_business", label: "Fluxiva Business" },
];

/** @deprecated Use FLUXIVA_PLAN_OPTIONS */
export const PF_PLAN_OPTIONS = [
  { slug: "pf_basico",  label: "Fluxiva Light (legado)" },
  { slug: "pf_plus",    label: "Fluxiva Start (legado)" },
  { slug: "pf_premium", label: "Fluxiva Pro (legado)" },
];

/** @deprecated Use FLUXIVA_PLAN_OPTIONS */
export const PJ_PLAN_OPTIONS = [
  { slug: "pj_start",    label: "Fluxiva Start (legado)" },
  { slug: "pj_pro",      label: "Fluxiva Pro (legado)" },
  { slug: "pj_business", label: "Fluxiva Business (legado)" },
];
