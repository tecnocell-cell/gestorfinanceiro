/**
 * Regras comerciais definitivas por plano — Etapa 7.0
 * Fonte única para recursos, menus e mensagens públicas.
 */

export const OPEN_FINANCE_ADDON_DEFAULT = {
  ativo: false,
  precoCentavos: 0,
  futuroPrecoSugeridoCentavos: 2990,
  descricao: 'Conexão bancária automática via Open Finance',
  observacao: 'Disponível em breve como add-on',
};

function addon(futuroCentavos = 2990) {
  return {
    ...OPEN_FINANCE_ADDON_DEFAULT,
    futuroPrecoSugeridoCentavos: futuroCentavos,
  };
}

/** @type {Record<string, { nome: string, precoCentavos: number, segmento: 'pf'|'pj', recursos: object }>} */
export const PLAN_CATALOG = {
  pf_basico: {
    nome: 'PF Básico',
    precoCentavos: 1990,
    segmento: 'pf',
    recursos: {
      limiteUsuarios: 1,
      limiteWhatsappNumeros: 1,
      limiteLancamentos: null,
      limiteClientes: null,
      limiteProjetos: null,
      limiteCentrosCusto: null,
      whatsappTexto: true,
      whatsappAudio: false,
      whatsappComprovante: false,
      iaComprovante: false,
      categoriasAvancadas: false,
      relatoriosCompletos: false,
      dreCompleto: false,
      centroCusto: false,
      projetos: false,
      resultadoClienteProjeto: false,
      apiAccess: false,
      suportePrioritario: false,
      openFinance: false,
      integracaoPfPj: false,
      openFinanceAddon: addon(2990),
    },
  },
  pf_plus: {
    nome: 'PF Plus',
    precoCentavos: 2990,
    segmento: 'pf',
    recursos: {
      limiteUsuarios: 1,
      limiteWhatsappNumeros: 3,
      limiteLancamentos: null,
      whatsappTexto: true,
      whatsappAudio: true,
      whatsappComprovante: false,
      iaComprovante: false,
      categoriasAvancadas: true,
      relatoriosCompletos: true,
      dreCompleto: false,
      centroCusto: true,
      projetos: true,
      resultadoClienteProjeto: true,
      apiAccess: false,
      suportePrioritario: false,
      openFinance: false,
      integracaoPfPj: false,
      openFinanceAddon: addon(2990),
    },
  },
  /** PF Premium: até 5 números; texto, áudio e imagem/comprovante via WhatsApp */
  pf_premium: {
    nome: 'PF Premium',
    precoCentavos: 4990,
    segmento: 'pf',
    recursos: {
      limiteUsuarios: 1,
      limiteWhatsappNumeros: 5,
      limiteLancamentos: null,
      whatsappTexto: true,
      whatsappAudio: true,
      whatsappComprovante: true,
      iaComprovante: true,
      categoriasAvancadas: true,
      relatoriosCompletos: true,
      dreCompleto: false,
      centroCusto: true,
      projetos: true,
      resultadoClienteProjeto: true,
      apiAccess: false,
      suportePrioritario: true,
      openFinance: false,
      integracaoPfPj: false,
      openFinanceAddon: addon(4990),
    },
  },
  pj_start: {
    nome: 'PJ Start',
    precoCentavos: 5990,
    segmento: 'pj',
    recursos: {
      limiteUsuarios: 3,
      limiteWhatsappNumeros: 2,
      limiteLancamentos: null,
      whatsappTexto: true,
      whatsappAudio: true,
      whatsappComprovante: false,
      iaComprovante: false,
      categoriasAvancadas: false,
      relatoriosCompletos: true,
      dreCompleto: false,
      dreSimplificado: true,
      centroCusto: true,
      projetos: false,
      projetosAvancados: false,
      resultadoClienteProjeto: false,
      apiAccess: false,
      suportePrioritario: false,
      openFinance: false,
      integracaoPfPj: true,
      openFinanceAddon: addon(2990),
    },
  },
  pj_pro: {
    nome: 'PJ Pro',
    precoCentavos: 9990,
    segmento: 'pj',
    recursos: {
      limiteUsuarios: 8,
      limiteWhatsappNumeros: 5,
      limiteLancamentos: null,
      whatsappTexto: true,
      whatsappAudio: true,
      whatsappComprovante: true,
      iaComprovante: true,
      categoriasAvancadas: true,
      relatoriosCompletos: true,
      dreCompleto: true,
      dreSimplificado: true,
      centroCusto: true,
      projetos: true,
      projetosAvancados: true,
      resultadoClienteProjeto: true,
      apiAccess: false,
      suportePrioritario: false,
      openFinance: false,
      integracaoPfPj: true,
      openFinanceAddon: addon(2990),
    },
  },
  pj_business: {
    nome: 'PJ Business',
    precoCentavos: 19990,
    segmento: 'pj',
    recursos: {
      limiteUsuarios: 20,
      limiteWhatsappNumeros: 15,
      limiteLancamentos: null,
      whatsappTexto: true,
      whatsappAudio: true,
      whatsappComprovante: true,
      iaComprovante: true,
      categoriasAvancadas: true,
      relatoriosCompletos: true,
      dreCompleto: true,
      dreSimplificado: true,
      centroCusto: true,
      projetos: true,
      projetosAvancados: true,
      resultadoClienteProjeto: true,
      apiAccess: true,
      suportePrioritario: true,
      governancaFinanceira: true,
      openFinance: false,
      integracaoPfPj: true,
      openFinanceAddon: addon(4990),
    },
  },
};

export const DEFAULT_RESOURCES_BY_SLUG = Object.fromEntries(
  Object.entries(PLAN_CATALOG).map(([slug, plan]) => [
    slug,
    { segmento: plan.segmento, ...plan.recursos },
  ])
);

/** Legado */
DEFAULT_RESOURCES_BY_SLUG.free = {
  limiteLancamentos: 100,
  openFinance: false,
  integracaoPfPj: false,
  segmento: 'pf',
  whatsappTexto: true,
};
DEFAULT_RESOURCES_BY_SLUG.pro = {
  limiteLancamentos: 2000,
  openFinance: false,
  integracaoPfPj: true,
  segmento: 'pf',
  whatsappTexto: true,
};
DEFAULT_RESOURCES_BY_SLUG.empresarial = {
  limiteLancamentos: null,
  openFinance: false,
  integracaoPfPj: true,
  suportePrioritario: true,
  segmento: 'pj',
  whatsappTexto: true,
};

export const COMMERCIAL_PLAN_SLUGS = {
  pf: ['pf_basico', 'pf_plus', 'pf_premium'],
  pj: ['pj_start', 'pj_pro', 'pj_business'],
  fluxiva: ['fluxiva_light', 'fluxiva_start', 'fluxiva_pro', 'fluxiva_business'],
};

// ── Planos unificados Fluxiva — estrutura comercial definitiva ────────────────

/** Fluxiva Light — controle pessoal, sem ambiente empresa */
PLAN_CATALOG.fluxiva_light = {
  nome: 'Fluxiva Light',
  precoCentavos: 1990,
  segmento: 'fluxiva',
  recursos: {
    maxAmbientes: 1,
    limiteUsuarios: 1,
    limiteWhatsappNumeros: 1,
    limiteLancamentos: null,
    whatsappTexto: true,
    whatsappAudio: false,
    whatsappComprovante: false,
    iaComprovante: false,
    categoriasAvancadas: false,
    relatoriosCompletos: false,
    dre: false,
    dreCompleto: false,
    dreSimplificado: false,
    centroCusto: false,
    projetos: false,
    resultadoClienteProjeto: false,
    apiAccess: false,
    suportePrioritario: false,
    openFinance: false,
    integracaoPfPj: false,
    openFinanceAddon: addon(2990),
  },
};

/** Fluxiva Start — pessoal + empresa, 1 usuário */
PLAN_CATALOG.fluxiva_start = {
  nome: 'Fluxiva Start',
  precoCentavos: 2990,
  segmento: 'fluxiva',
  recursos: {
    maxAmbientes: 2,
    limiteUsuarios: 1,
    limiteWhatsappNumeros: 1,
    limiteLancamentos: null,
    whatsappTexto: true,
    whatsappAudio: false,
    whatsappComprovante: false,
    iaComprovante: false,
    categoriasAvancadas: false,
    relatoriosCompletos: false,
    dre: false,
    dreCompleto: false,
    dreSimplificado: false,
    centroCusto: false,
    projetos: false,
    resultadoClienteProjeto: false,
    apiAccess: false,
    suportePrioritario: false,
    openFinance: false,
    integracaoPfPj: true,
    openFinanceAddon: addon(2990),
  },
};

/** Fluxiva Pro — até 5 usuários, 3 WA, 5 ambientes, DRE, centro de custo */
PLAN_CATALOG.fluxiva_pro = {
  nome: 'Fluxiva Pro',
  precoCentavos: 7990,
  segmento: 'fluxiva',
  recursos: {
    maxAmbientes: 5,
    limiteUsuarios: 5,
    limiteWhatsappNumeros: 3,
    limiteLancamentos: null,
    whatsappTexto: true,
    whatsappAudio: true,
    whatsappComprovante: false,
    iaComprovante: false,
    categoriasAvancadas: true,
    relatoriosCompletos: true,
    dre: true,
    dreCompleto: false,
    dreSimplificado: true,
    centroCusto: true,
    projetos: false,
    resultadoClienteProjeto: true,
    apiAccess: false,
    suportePrioritario: false,
    openFinance: false,
    integracaoPfPj: true,
    openFinanceAddon: addon(2990),
  },
};

/** Fluxiva Business — até 20 usuários, 5 WA, ambientes ilimitados, IA completa */
PLAN_CATALOG.fluxiva_business = {
  nome: 'Fluxiva Business',
  precoCentavos: 29990,
  segmento: 'fluxiva',
  recursos: {
    maxAmbientes: null,
    limiteUsuarios: 20,
    limiteWhatsappNumeros: 5,
    limiteLancamentos: null,
    whatsappTexto: true,
    whatsappAudio: true,
    whatsappComprovante: true,
    iaComprovante: true,
    categoriasAvancadas: true,
    relatoriosCompletos: true,
    dre: true,
    dreCompleto: true,
    dreSimplificado: true,
    centroCusto: true,
    projetos: true,
    projetosAvancados: true,
    resultadoClienteProjeto: true,
    apiAccess: true,
    suportePrioritario: true,
    governancaFinanceira: true,
    openFinance: false,
    integracaoPfPj: true,
    openFinanceAddon: addon(4990),
  },
};

/**
 * Mapeia plano legado (PF/PJ) para equivalente Fluxiva.
 * Mantido para compatibilidade — usuários antigos não quebram.
 */
export const LEGACY_PLAN_MAP = {
  pf_basico:    'fluxiva_light',
  pf_plus:      'fluxiva_start',
  pf_premium:   'fluxiva_pro',
  pj_start:     'fluxiva_start',
  pj_pro:       'fluxiva_pro',
  pj_business:  'fluxiva_business',
  free:         'fluxiva_light',
  pro:          'fluxiva_pro',
  empresarial:  'fluxiva_business',
};

/**
 * Retorna recursos unificados para qualquer slug (legado ou novo).
 * Planos legados herdam recursos do equivalente Fluxiva +
 * mantêm recursos originais para não quebrar nada existente.
 */
export function getUnifiedRecursos(slug, recursosBase = {}) {
  const mapped = LEGACY_PLAN_MAP[slug];
  if (!mapped) return recursosBase;
  const fluxivaRecursos = PLAN_CATALOG[mapped]?.recursos || {};
  // Merge: legado complementa com campos novos (maxAmbientes, dre)
  return {
    ...fluxivaRecursos,
    ...recursosBase,
    // Campos novos que legado não tem — vêm do equivalente Fluxiva
    maxAmbientes: recursosBase.maxAmbientes ?? fluxivaRecursos.maxAmbientes ?? 1,
    dre: recursosBase.dre ?? fluxivaRecursos.dre ?? false,
  };
}

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
  /public[_\s-]?key/i,
  /access[_\s-]?token/i,
  /webhook[_\s-]?secret/i,
  /client[_\s-]?secret/i,
  /asaas/i,
  /mercado\s*pago/i,
  /pluggy/i,
  /smtp/i,
  /resend/i,
  /provider\s*mock/i,
  /\bprovider\b/i,
  /\bgateway\b/i,
  /\bmock\b/i,
  /\bsandbox\b/i,
  /stack\s*trace/i,
  /evolution\s*api/i,
  /OPENFINANCE_/i,
  /BILLING_USE_MOCK/i,
  /configure\s+/i,
];

export function sanitizePublicMessage(msg) {
  if (!msg || typeof msg !== 'string') return msg;
  if (TECHNICAL_PATTERNS.some((re) => re.test(msg))) {
    return PUBLIC_MESSAGES.planBlocked;
  }
  return msg;
}

/**
 * Visibilidade de item de menu: show | hide | blocked
 * @param {string} menuId
 * @param {object} recursos
 * @param {{ segmento?: 'pf'|'pj' }} ctx
 */
/**
 * Visibilidade de item de menu.
 * ctx.tipoAmbiente: 'pessoal' | 'empresa'  — define qual menu mostrar
 * ctx.segmento: legado, usado se tipoAmbiente ausente
 */
export function getMenuAccess(menuId, recursos = {}, ctx = {}) {
  const r = recursos || {};
  const tipoAmbiente = ctx.tipoAmbiente;
  const isEmpresa = tipoAmbiente === 'empresa';
  const isPessoal = tipoAmbiente === 'pessoal' ||
    (!tipoAmbiente && (ctx.segmento || r.segmento || 'pf') === 'pf');

  const hide = (id) => (menuId === id ? 'hide' : null);
  const block = (id) => (menuId === id ? 'blocked' : null);

  // Integração PF/PJ obsoleta no modelo unificado
  { const h = hide('integracao-pf-pj'); if (h) return h; }

  if (isPessoal) {
    const empresariais = ['dre', 'clientes', 'fornecedores', 'plano', 'impostos',
      'projetos', 'resultado-projeto', 'resultado-cliente', 'resultado-centro-custo',
      'importacoes', 'conciliacao', 'balancete', 'fechamento', 'equipe'];
    if (empresariais.includes(menuId)) return 'hide';
    return 'show';
  }

  // Ambiente empresa — controle por plano
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
  if (!r.dre && !r.dreCompleto && !r.dreSimplificado) {
    const b = block('dre');
    if (b) return b;
  }

  return 'show';
}

export function whatsappCapabilitiesFromRecursos(recursos = {}) {
  return {
    max_authorized_numbers: recursos.limiteWhatsappNumeros ?? 1,
    ai_text_enabled: recursos.whatsappTexto !== false,
    ai_audio_enabled: Boolean(recursos.whatsappAudio),
    ai_receipt_enabled: Boolean(recursos.whatsappComprovante || recursos.iaComprovante),
  };
}

export function formatPlanPrice(centavos) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    (centavos || 0) / 100
  );
}
