/**
 * Exportação pública do catálogo — fonte única PLAN_CATALOG (Etapa 7.2)
 */
import { PLAN_CATALOG } from './planRules.js';

export function getPublicPlanCatalog() {
  return Object.entries(PLAN_CATALOG).map(([slug, plan]) => ({
    slug,
    nome: plan.nome,
    precoCentavos: plan.precoCentavos,
    precoReais: plan.precoCentavos / 100,
    segmento: plan.segmento,
    limiteUsuarios: plan.recursos.limiteUsuarios ?? null,
    limiteWhatsappNumeros: plan.recursos.limiteWhatsappNumeros ?? null,
    whatsappTexto: Boolean(plan.recursos.whatsappTexto),
    whatsappAudio: Boolean(plan.recursos.whatsappAudio),
    whatsappComprovante: Boolean(plan.recursos.whatsappComprovante),
  }));
}
