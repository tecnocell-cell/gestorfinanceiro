/** Recursos comerciais por slug — Etapa 6.3B */

export const OPEN_FINANCE_ADDON_DEFAULT = {
  ativo: false,
  precoCentavos: 0,
  futuroPrecoSugeridoCentavos: 2990,
  descricao: 'Conexão bancária automática via Open Finance',
  observacao: 'Disponível após ativação do provedor Pluggy',
};

function addon(futuroCentavos = 2990) {
  return {
    ...OPEN_FINANCE_ADDON_DEFAULT,
    futuroPrecoSugeridoCentavos: futuroCentavos,
  };
}

const PF_BASICO = {
  segmento: 'pf',
  limiteUsuarios: 1,
  limiteWhatsappNumeros: 1,
  limiteLancamentos: null,
  whatsappTexto: true,
  whatsappAudio: false,
  whatsappComprovante: false,
  iaComprovante: false,
  dreCompleto: false,
  centroCusto: false,
  projetos: false,
  apiAccess: false,
  suportePrioritario: false,
  openFinance: false,
  integracaoPfPj: false,
  openFinanceAddon: addon(2990),
};

export const DEFAULT_RESOURCES_BY_SLUG = {
  pf_basico: { ...PF_BASICO },
  pf_plus: {
    ...PF_BASICO,
    limiteWhatsappNumeros: 3,
    whatsappAudio: true,
    openFinanceAddon: addon(2990),
  },
  pf_premium: {
    ...PF_BASICO,
    limiteWhatsappNumeros: 5,
    whatsappAudio: true,
    whatsappComprovante: true,
    iaComprovante: true,
    suportePrioritario: true,
    openFinanceAddon: addon(4990),
  },
  pj_start: {
    segmento: 'pj',
    limiteUsuarios: 3,
    limiteWhatsappNumeros: 2,
    limiteLancamentos: null,
    whatsappTexto: true,
    whatsappAudio: true,
    whatsappComprovante: false,
    iaComprovante: false,
    dreCompleto: false,
    centroCusto: true,
    projetos: false,
    apiAccess: false,
    suportePrioritario: false,
    openFinance: false,
    integracaoPfPj: true,
    openFinanceAddon: addon(2990),
  },
  pj_pro: {
    segmento: 'pj',
    limiteUsuarios: 8,
    limiteWhatsappNumeros: 5,
    limiteLancamentos: null,
    whatsappTexto: true,
    whatsappAudio: true,
    whatsappComprovante: true,
    iaComprovante: true,
    dreCompleto: true,
    centroCusto: true,
    projetos: true,
    apiAccess: false,
    suportePrioritario: false,
    openFinance: false,
    integracaoPfPj: true,
    openFinanceAddon: addon(2990),
  },
  pj_business: {
    segmento: 'pj',
    limiteUsuarios: 20,
    limiteWhatsappNumeros: 15,
    limiteLancamentos: null,
    whatsappTexto: true,
    whatsappAudio: true,
    whatsappComprovante: true,
    iaComprovante: true,
    dreCompleto: true,
    centroCusto: true,
    projetos: true,
    apiAccess: true,
    suportePrioritario: true,
    openFinance: false,
    integracaoPfPj: true,
    openFinanceAddon: addon(4990),
  },
  /** Legado — assinaturas antigas até migração */
  free: { limiteLancamentos: 100, openFinance: false, integracaoPfPj: false, segmento: 'pf' },
  pro: { limiteLancamentos: 2000, openFinance: false, integracaoPfPj: true, segmento: 'pf' },
  empresarial: {
    limiteLancamentos: null,
    openFinance: false,
    integracaoPfPj: true,
    suportePrioritario: true,
    segmento: 'pj',
  },
};

export const COMMERCIAL_PLAN_SLUGS = {
  pf: ['pf_basico', 'pf_plus', 'pf_premium'],
  pj: ['pj_start', 'pj_pro', 'pj_business'],
};

export function normalizeTipoPerfilBilling(tipo) {
  const t = String(tipo || '').toLowerCase().trim();
  return t === 'fisica' || t === 'pf' ? 'fisica' : 'juridica';
}

export function segmentoFromTipoPerfil(tipoPerfil) {
  return normalizeTipoPerfilBilling(tipoPerfil) === 'fisica' ? 'pf' : 'pj';
}

export function segmentoFromSlug(slug) {
  const s = String(slug || '');
  if (s.startsWith('pf_') || s === 'free' || s === 'pro') return 'pf';
  if (s.startsWith('pj_') || s === 'empresarial') return 'pj';
  return null;
}

export function defaultPlanoSlugForTipo(tipoPerfil) {
  return segmentoFromTipoPerfil(tipoPerfil) === 'pf' ? 'pf_basico' : 'pj_start';
}

export function planoMatchesTipoPerfil(slug, tipoPerfil) {
  const seg = segmentoFromSlug(slug);
  if (!seg) return false;
  return seg === segmentoFromTipoPerfil(tipoPerfil);
}

export function mergeRecursos(slug, recursosDb = {}) {
  const base = DEFAULT_RESOURCES_BY_SLUG[slug] || DEFAULT_RESOURCES_BY_SLUG.pf_basico;
  const fromDb = typeof recursosDb === 'string' ? JSON.parse(recursosDb) : recursosDb || {};
  const merged = { ...base, ...fromDb };
  if (fromDb.openFinanceAddon) {
    merged.openFinanceAddon = { ...base.openFinanceAddon, ...fromDb.openFinanceAddon };
  } else if (base.openFinanceAddon && !merged.openFinanceAddon) {
    merged.openFinanceAddon = { ...base.openFinanceAddon };
  }
  return merged;
}

export function hasRecurso(recursos, key) {
  return Boolean(recursos?.[key]);
}

export function canUseOpenFinanceReal(recursos) {
  return hasRecurso(recursos, 'openFinance') || recursos?.openFinanceAddon?.ativo === true;
}

export function getLimiteLancamentos(recursos) {
  const lim = recursos?.limiteLancamentos;
  if (lim === null || lim === undefined) return null;
  const n = Number(lim);
  return Number.isFinite(n) ? n : null;
}

export function buildLimiteAvisos({ recursos, totalLancamentos = 0 }) {
  const avisos = [];
  const limite = getLimiteLancamentos(recursos);

  if (limite != null && totalLancamentos >= limite) {
    avisos.push(
      `Você atingiu o limite de ${limite} lançamentos do seu plano. Considere fazer upgrade.`
    );
  } else if (limite != null && totalLancamentos >= limite * 0.9) {
    avisos.push(
      `Você está próximo do limite de ${limite} lançamentos (${totalLancamentos} em uso).`
    );
  }

  if (!canUseOpenFinanceReal(recursos)) {
    const addon = recursos?.openFinanceAddon;
    if (addon?.futuroPrecoSugeridoCentavos) {
      const preco = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(addon.futuroPrecoSugeridoCentavos / 100);
      avisos.push(
        `Open Finance automático (Pluggy) será add-on opcional (a partir de ${preco}). Importação OFX/CSV continua disponível.`
      );
    } else {
      avisos.push('Open Finance automático disponível como add-on futuro. Use importação OFX/CSV.');
    }
  }

  if (!hasRecurso(recursos, 'integracaoPfPj')) {
    avisos.push('Integração PF/PJ disponível nos planos PJ.');
  }

  return avisos;
}

export function canUseRecurso(recursos, key) {
  if (key === 'openFinance') {
    return canUseOpenFinanceReal(recursos);
  }
  if (key === 'integracaoPfPj' || key === 'suportePrioritario') {
    return hasRecurso(recursos, key);
  }
  return true;
}
