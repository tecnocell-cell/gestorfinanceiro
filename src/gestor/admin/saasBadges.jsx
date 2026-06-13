const PLAN_STYLES = {
  pf_basico: { label: "Fluxiva Start", className: "saas-badge-plan saas-badge-plan--gray" },
  pf_plus: { label: "Fluxiva Pro", className: "saas-badge-plan saas-badge-plan--blue" },
  pf_premium: { label: "Fluxiva Business", className: "saas-badge-plan saas-badge-plan--purple" },
  pj_start: { label: "Fluxiva Start", className: "saas-badge-plan saas-badge-plan--green" },
  pj_pro: { label: "Fluxiva Pro", className: "saas-badge-plan saas-badge-plan--orange" },
  pj_business: { label: "Fluxiva Business", className: "saas-badge-plan saas-badge-plan--gold" },
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

export const PF_PLAN_OPTIONS = [
  { slug: "pf_basico", label: "Fluxiva Start" },
  { slug: "pf_plus", label: "Fluxiva Pro" },
  { slug: "pf_premium", label: "Fluxiva Business" },
];

export const PJ_PLAN_OPTIONS = [
  { slug: "pj_start", label: "Fluxiva Start" },
  { slug: "pj_pro", label: "Fluxiva Pro" },
  { slug: "pj_business", label: "Fluxiva Business" },
];
