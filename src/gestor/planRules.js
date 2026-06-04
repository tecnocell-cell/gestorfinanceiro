/**
 * Regras comerciais por plano (espelho frontend) — Etapa 7.0
 * Manter alinhado com server/billing/planRules.js
 */

export const PUBLIC_MESSAGES = {
  billing:
    'Contratação online em ativação. Fale com suporte para ativar seu plano.',
  email: 'Envio automático de e-mail em ativação. Se precisar, fale com o suporte.',
  openFinance:
    'Conexão bancária automática em breve. Você pode importar OFX/CSV normalmente.',
  planBlocked: 'Este recurso não está incluso no seu plano atual.',
  whatsappLimit: 'Limite do plano atingido.',
  whatsappInactive:
    'WhatsApp em ativação. Você ainda pode usar lançamentos manuais.',
  checkoutModalTitle: 'Contratação online em ativação',
  checkoutModalBody: 'Fale com o suporte para ativar seu plano.',
};

export const SUPPORT_WHATSAPP_URL = 'https://wa.me/5594981406316';

const TECHNICAL_PATTERNS = [
  /ASAAS_API_KEY/i,
  /asaas/i,
  /pluggy/i,
  /smtp/i,
  /resend/i,
  /provider\s*mock/i,
  /evolution\s*api/i,
  /OPENFINANCE_/i,
];

export function sanitizePublicMessage(msg) {
  if (!msg || typeof msg !== 'string') return msg;
  if (TECHNICAL_PATTERNS.some((re) => re.test(msg))) {
    return PUBLIC_MESSAGES.planBlocked;
  }
  return msg;
}

export function getMenuAccess(menuId, recursos = {}, ctx = {}) {
  const seg = ctx.segmento || recursos.segmento || 'pf';
  const r = recursos || {};

  const hide = (id) => (menuId === id ? 'hide' : null);
  const block = (id) => (menuId === id ? 'blocked' : null);

  if (seg === 'pf') {
    if (!r.integracaoPfPj) {
      const h = hide('integracao-pf-pj');
      if (h) return h;
    }
    if (!r.projetos) {
      const b = block('projetos');
      if (b) return b;
      const h2 = hide('resultado-projeto');
      if (h2) return h2;
      const h3 = hide('resultado-cliente');
      if (h3) return h3;
    }
    if (!r.centroCusto) {
      const h = hide('resultado-centro-custo');
      if (h) return h;
    }
    return 'show';
  }

  if (!r.integracaoPfPj) {
    const h = hide('integracao-pf-pj');
    if (h) return h;
  }
  if (!r.projetos && !r.projetosAvancados) {
    const b = block('projetos');
    if (b) return b;
    const h = hide('resultado-projeto');
    if (h) return h;
  }
  if (!r.resultadoClienteProjeto) {
    const h = hide('resultado-cliente');
    if (h) return h;
  }
  if (!r.centroCusto) {
    const h = hide('resultado-centro-custo');
    if (h) return h;
  }
  if (!r.dreCompleto && !r.dreSimplificado) {
    const h = hide('dre');
    if (h) return h;
  }

  return 'show';
}

export function mapConfigStatusForUser(status, { isAdmin, isDev }) {
  if (!status) return null;
  if (isAdmin || isDev) return status;

  return {
    email: {
      configured: status.email?.configured,
      message: status.email?.configured ? 'E-mail ativo.' : PUBLIC_MESSAGES.email,
    },
    whatsapp: {
      configured: status.whatsapp?.configured,
      message: status.whatsapp?.configured
        ? 'WhatsApp disponível.'
        : 'WhatsApp em configuração. Fale com o suporte se precisar.',
    },
    billing: {
      configured: status.billing?.configured,
      allowSimulate: status.billing?.allowSimulate,
      message: status.billing?.configured
        ? 'Assinaturas online ativas.'
        : PUBLIC_MESSAGES.billing,
    },
    openFinance: {
      configured: status.openFinance?.configured,
      demoMode: status.openFinance?.demoMode,
      message: PUBLIC_MESSAGES.openFinance,
    },
  };
}

export const FEATURE_LABELS = {
  openFinance: 'Conexão bancária automática',
  integracaoPfPj: 'Integração PF/PJ',
  projetos: 'Projetos financeiros',
  centroCusto: 'Centros de custo',
  whatsappTexto: 'WhatsApp (texto)',
  whatsappAudio: 'WhatsApp (áudio)',
  whatsappComprovante: 'WhatsApp (comprovante)',
  iaComprovante: 'Leitura de comprovante por IA',
};
