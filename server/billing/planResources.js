/** Recursos padrão por slug — base para controle de acesso (soft, sem bloqueio agressivo). */

export const DEFAULT_RESOURCES_BY_SLUG = {
  free: {
    limiteLancamentos: 100,
    openFinance: false,
    integracaoPfPj: false,
  },
  pro: {
    limiteLancamentos: 2000,
    openFinance: true,
    integracaoPfPj: true,
  },
  empresarial: {
    limiteLancamentos: null,
    openFinance: true,
    integracaoPfPj: true,
    suportePrioritario: true,
  },
};

export function mergeRecursos(slug, recursosDb = {}) {
  const base = DEFAULT_RESOURCES_BY_SLUG[slug] || DEFAULT_RESOURCES_BY_SLUG.free;
  const fromDb = typeof recursosDb === 'string' ? JSON.parse(recursosDb) : recursosDb || {};
  return { ...base, ...fromDb };
}

export function hasRecurso(recursos, key) {
  return Boolean(recursos?.[key]);
}

export function getLimiteLancamentos(recursos) {
  const lim = recursos?.limiteLancamentos;
  if (lim === null || lim === undefined) return null;
  const n = Number(lim);
  return Number.isFinite(n) ? n : null;
}

/** Avisos informativos — não bloqueia operações existentes. */
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

  if (!hasRecurso(recursos, 'openFinance')) {
    avisos.push('Open Finance disponível nos planos Pro e Empresarial.');
  }
  if (!hasRecurso(recursos, 'integracaoPfPj')) {
    avisos.push('Integração PF/PJ disponível nos planos Pro e Empresarial.');
  }

  return avisos;
}

export function canUseRecurso(recursos, key) {
  if (key === 'openFinance' || key === 'integracaoPfPj' || key === 'suportePrioritario') {
    return hasRecurso(recursos, key);
  }
  return true;
}
