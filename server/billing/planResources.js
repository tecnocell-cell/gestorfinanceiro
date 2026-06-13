/** Recursos comerciais por slug — reexporta planRules (Etapa 7.0) */

export {
  OPEN_FINANCE_ADDON_DEFAULT,
  DEFAULT_RESOURCES_BY_SLUG,
  COMMERCIAL_PLAN_SLUGS,
  PLAN_CATALOG,
  LEGACY_PLAN_MAP,
  PUBLIC_MESSAGES,
  getMenuAccess,
  whatsappCapabilitiesFromRecursos,
  sanitizePublicMessage,
  getUnifiedRecursos,
} from './planRules.js';

import {
  DEFAULT_RESOURCES_BY_SLUG,
  OPEN_FINANCE_ADDON_DEFAULT,
  PLAN_CATALOG,
} from './planRules.js';

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

  // Planos comerciais: planRules.js é fonte única (Etapa 7.0)
  if (PLAN_CATALOG[slug]) {
    const merged = { ...base };
    if (fromDb.openFinanceAddon) {
      merged.openFinanceAddon = { ...base.openFinanceAddon, ...fromDb.openFinanceAddon };
    }
    return merged;
  }

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

  if (limite != null && totalLancamentos > limite) {
    avisos.push(
      `Você atingiu o limite de ${limite} lançamentos do seu plano. Considere fazer upgrade.`
    );
  } else if (limite != null && totalLancamentos >= limite * 0.9) {
    avisos.push(
      `Você está próximo do limite de ${limite} lançamentos (${totalLancamentos} em uso).`
    );
  }

  if (!canUseOpenFinanceReal(recursos)) {
    avisos.push(
      'Conexão bancária automática em breve. Você pode importar OFX/CSV normalmente.'
    );
  }

  if (!hasRecurso(recursos, 'integracaoPfPj')) {
    avisos.push('Integração PF/PJ disponível nos planos PJ.');
  }

  return avisos;
}

export function applyRecursosByStatus(recursos, status, planoSlug) {
  if (status !== 'vencida' || !recursos) return recursos;

  const basicSlug = segmentoFromSlug(planoSlug) === 'pj' ? 'pj_start' : 'pf_basico';
  const basic = mergeRecursos(basicSlug, {});
  const out = { ...recursos };

  for (const [key, val] of Object.entries(basic)) {
    if (typeof val === 'boolean' && val === false && out[key] === true) {
      out[key] = false;
    }
  }
  if (basic.limiteUsuarios != null) out.limiteUsuarios = basic.limiteUsuarios;
  if (basic.limiteWhatsappNumeros != null) out.limiteWhatsappNumeros = basic.limiteWhatsappNumeros;
  out._premiumBloqueado = true;
  return out;
}

export function canUseRecurso(recursos, key) {
  if (recursos?._premiumBloqueado) {
    const premiumKeys = [
      'whatsappAudio',
      'whatsappComprovante',
      'iaComprovante',
      'suportePrioritario',
      'dreCompleto',
      'projetos',
      'apiAccess',
      'integracaoPfPj',
    ];
    if (premiumKeys.includes(key)) return false;
  }
  if (key === 'openFinance') {
    return canUseOpenFinanceReal(recursos);
  }
  if (key === 'integracaoPfPj' || key === 'suportePrioritario') {
    return hasRecurso(recursos, key);
  }
  return true;
}
