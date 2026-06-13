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
  /MP_ACCESS_TOKEN/i,
  /ACCESS_TOKEN/i,
  /api[_\s-]?key/i,
  /public[_\s-]?key/i,
  /access[_\s-]?token/i,
  /webhook[_\s-]?secret/i,
  /client[_\s-]?secret/i,
  /asaas/i,
  /mercado\s*pago/i,
  /pluggy/i,
  /smtp/i,
  /resend/i,
  /\bprovider\b/i,
  /\bgateway\b/i,
  /webhook/i,
  /\bmock\b/i,
  /\bsandbox\b/i,
  /stack\s*trace/i,
  /evolution\s*api/i,
  /OPENFINANCE_/i,
  /BILLING_USE_MOCK/i,
  /ECONNREFUSED/i,
  /ENOTFOUND/i,
];

export function sanitizePublicMessage(msg) {
  if (!msg || typeof msg !== 'string') return msg;
  if (TECHNICAL_PATTERNS.some((re) => re.test(msg))) {
    return PUBLIC_MESSAGES.planBlocked;
  }
  return msg;
}

/**
 * Visibilidade de item de menu.
 * ctx.tipoAmbiente: 'pessoal' | 'empresa'  — define qual menu mostrar
 * ctx.segmento: 'pf'|'pj'                  — legado (ignorado se tipoAmbiente presente)
 * recursos: capabilities do plano            — define se recurso está liberado
 */
export function getMenuAccess(menuId, recursos = {}, ctx = {}) {
  const r = recursos || {};

  // Modelo unificado: tipoAmbiente define menu; plano define se está liberado
  const tipoAmbiente = ctx.tipoAmbiente;
  const isEmpresa = tipoAmbiente === 'empresa';
  const isPessoal = tipoAmbiente === 'pessoal' || (!tipoAmbiente && (ctx.segmento || r.segmento || 'pf') === 'pf');

  const hide = (id) => (menuId === id ? 'hide' : null);
  const block = (id) => (menuId === id ? 'blocked' : null);

  // Integração PF/PJ — sempre oculta (conceito ultrapassado no novo modelo)
  { const h = hide('integracao-pf-pj'); if (h) return h; }

  if (isPessoal) {
    // Ambiente pessoal: ocultar menus exclusivamente empresariais
    const empresariais = ['dre', 'clientes', 'fornecedores', 'plano', 'impostos',
      'projetos', 'resultado-projeto', 'resultado-cliente', 'resultado-centro-custo',
      'importacoes', 'conciliacao', 'balancete', 'fechamento', 'equipe'];
    const h = hide(...empresariais.filter((id) => id === menuId));
    if (h) return h;
    if (empresariais.includes(menuId)) return 'hide';
    return 'show';
  }

  // Ambiente empresa — aplica regras de plano
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
  // DRE: aparece no ambiente empresa; bloqueado se plano não permitir
  if (!r.dre && !r.dreCompleto && !r.dreSimplificado) {
    const b = block('dre');
    if (b) return b;
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
