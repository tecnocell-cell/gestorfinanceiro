/** Metadados visuais e features para cards de plano (gestor). */

/** Mapeamento visual de slugs legados para nomes Fluxiva unificados. */
export const PLAN_DISPLAY_NAMES = {
  pf_basico:     "Fluxiva Start",
  pf_plus:       "Fluxiva Pro",
  pf_premium:    "Fluxiva Business",
  pj_start:      "Fluxiva Start",
  pj_pro:        "Fluxiva Pro",
  pj_business:   "Fluxiva Business",
  fluxiva_start: "Fluxiva Start",
  fluxiva_pro:   "Fluxiva Pro",
  fluxiva_business: "Fluxiva Business",
};

/** Retorna nome de exibição Fluxiva para qualquer slug (legado ou novo). */
export function planDisplayName(slug) {
  return PLAN_DISPLAY_NAMES[slug] ?? null;
}

export const PLAN_BADGES = {
  pf_plus: { label: "Mais popular", tone: "popular" },
  pf_premium: { label: "Completo", tone: "premium" },
  pj_pro: { label: "Recomendado", tone: "popular" },
  pj_business: { label: "Empresarial", tone: "business" },
  fluxiva_start: { label: "Gratuito", tone: "neutral" },
  fluxiva_pro: { label: "Mais popular", tone: "popular" },
  fluxiva_business: { label: "Completo", tone: "business" },
};

export function planIconSlug(slug) {
  if (slug?.startsWith("pj_")) return "/fluxiva-icon.png";
  return "/fluxiva-icon.png";
}

/** Planos de entrada: sem teaser de Open Finance nos cards. */
const PLANOS_SEM_OPEN_FINANCE_CARD = new Set(["pf_basico", "pj_start"]);

export function buildPlanFeatureItems(recursos, planSlug) {
  if (!recursos) return [];
  const items = [];
  if (recursos.limiteUsuarios != null) {
    items.push(`${recursos.limiteUsuarios} usuário(s) na equipe`);
  }
  if (recursos.limiteWhatsappNumeros != null) {
    items.push(`${recursos.limiteWhatsappNumeros} número(s) WhatsApp`);
  }
  if (recursos.limiteLancamentos == null) {
    items.push("Lançamentos ilimitados");
  } else {
    items.push(`Até ${recursos.limiteLancamentos} lançamentos`);
  }
  if (recursos.whatsappTexto) items.push("WhatsApp: lançamento por texto");
  if (recursos.whatsappAudio) items.push("WhatsApp: lançamento por áudio");
  if (recursos.whatsappComprovante || recursos.iaComprovante) {
    items.push("WhatsApp: envio de imagem/comprovante (IA)");
  }
  if (recursos.centroCusto) {
    items.push(recursos.dreCompleto ? "Centro de custo avançado" : "Centro de custo");
  }
  if (recursos.dreCompleto) items.push("DRE completo");
  else if (recursos.segmento === "pj" && recursos.centroCusto) items.push("DRE simplificado");
  if (recursos.projetos) items.push("Projetos financeiros");
  if (recursos.integracaoPfPj && recursos.segmento === "pj") {
    items.push("Integração PF/PJ");
  }
  if (recursos.apiAccess) items.push("Acesso API");
  if (recursos.suportePrioritario) items.push("Suporte prioritário");
  if (recursos.openFinance) items.push("Open Finance incluso");
  if (recursos._premiumBloqueado) {
    items.push("Recursos premium limitados — regularize a assinatura");
  }
  const addon = recursos.openFinanceAddon;
  if (
    addon &&
    !recursos.openFinance &&
    planSlug &&
    !PLANOS_SEM_OPEN_FINANCE_CARD.has(planSlug)
  ) {
    items.push(
      addon.ativo ? "Open Finance add-on disponível" : "Open Finance add-on (em breve)"
    );
  }
  return items;
}

export function usageMetric(raw, nested) {
  if (nested && raw && typeof raw === "object") {
    return {
      usado: raw.usados ?? 0,
      limite: raw.limite,
    };
  }
  return { usado: raw ?? 0, limite: null };
}
