/** Metadados visuais e features para cards de plano (gestor). */

export const PLAN_BADGES = {
  pf_plus: { label: "Mais popular", tone: "popular" },
  pf_premium: { label: "Completo", tone: "premium" },
  pj_pro: { label: "Recomendado", tone: "popular" },
  pj_business: { label: "Empresarial", tone: "business" },
};

export function planIconSlug(slug) {
  if (slug?.startsWith("pj_")) return "/fluxiva-icon.png";
  return "/fluxiva-icon.png";
}

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
  if (recursos.whatsappComprovante) items.push("WhatsApp: comprovante");
  if (recursos.iaComprovante) items.push("Leitura de comprovante (IA)");
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
  if (addon && !recursos.openFinance && planSlug !== "pf_basico") {
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
