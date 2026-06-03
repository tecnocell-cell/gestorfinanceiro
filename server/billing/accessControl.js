/**
 * Controle de acesso por plano — Etapa 6.6
 */
import { query } from '../db.js';
import { ensureAssinaturaPadrao } from './subscriptions.js';
import { refreshSubscriptionLifecycle } from './subscriptionLifecycle.js';
import { buildBillingAvisos } from './subscriptionLifecycle.js';
import {
  mergeRecursos,
  applyRecursosByStatus,
  canUseOpenFinanceReal,
  buildLimiteAvisos,
} from './planResources.js';

export class PlanAccessError extends Error {
  constructor(message, { code = 'PLAN_LIMIT', status = 403, recurso = null, limite = null } = {}) {
    super(message);
    this.name = 'PlanAccessError';
    this.code = code;
    this.status = status;
    this.recurso = recurso;
    this.limite = limite;
  }
}

const FEATURE_KEYS = new Set([
  'openFinance',
  'integracaoPfPj',
  'whatsappAudio',
  'whatsappComprovante',
  'iaComprovante',
  'projetos',
  'centroCusto',
  'apiAccess',
  'suportePrioritario',
]);

const LIMIT_KEY_MAP = {
  lancamentos: 'limiteLancamentos',
  clientes: 'limiteClientes',
  projetos: 'limiteProjetos',
  centrosCusto: 'limiteCentrosCusto',
  usuarios: 'limiteUsuarios',
  whatsappNumeros: 'limiteWhatsappNumeros',
};

const FEATURE_GATE = {
  projetos: 'projetos',
  centrosCusto: 'centroCusto',
  centroCusto: 'centroCusto',
};

function numericLimit(recursos, key) {
  const v = recursos?.[key];
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function effectiveStatus(row) {
  const now = new Date();
  if (row.status === 'cancelada' && row.acesso_ate && now > new Date(row.acesso_ate)) {
    return 'vencida';
  }
  return row.status;
}

async function fetchAssinaturaRow(usuarioId) {
  await ensureAssinaturaPadrao(usuarioId);
  await refreshSubscriptionLifecycle(usuarioId);
  const { rows } = await query(
    `SELECT a.status, a.trial_ate, a.acesso_ate, a.fim_em,
            p.slug AS plano_slug, p.nome AS plano_nome, p.recursos AS plano_recursos
     FROM assinaturas a
     JOIN planos p ON p.id = a.plano_id
     WHERE a.usuario_id = $1`,
    [usuarioId]
  );
  return rows[0] || null;
}

export async function getUserSubscriptionResources(usuarioId) {
  const row = await fetchAssinaturaRow(usuarioId);
  if (!row) {
    throw new Error('Assinatura não encontrada.');
  }
  const status = effectiveStatus(row);
  let recursos = mergeRecursos(row.plano_slug, row.plano_recursos);
  recursos = applyRecursosByStatus(recursos, status, row.plano_slug);
  return {
    status,
    plano_slug: row.plano_slug,
    plano_nome: row.plano_nome,
    trial_ate: row.trial_ate,
    acesso_ate: row.acesso_ate,
    fim_em: row.fim_em,
    recursos,
  };
}

export function canUseResourceFromRecursos(recursos, recurso) {
  if (!recursos) return false;

  if (recurso === 'openFinance') {
    return canUseOpenFinanceReal(recursos);
  }

  if (FEATURE_KEYS.has(recurso)) {
    if (recursos._premiumBloqueado) {
      const premium = [
        'integracaoPfPj',
        'whatsappAudio',
        'whatsappComprovante',
        'iaComprovante',
        'projetos',
        'centroCusto',
        'apiAccess',
        'suportePrioritario',
        'dreCompleto',
      ];
      if (premium.includes(recurso)) return false;
    }
    return Boolean(recursos[recurso]);
  }

  return true;
}

export async function canUseResource(usuarioId, recurso) {
  const { recursos } = await getUserSubscriptionResources(usuarioId);
  return canUseResourceFromRecursos(recursos, recurso);
}

export function checkLimit(recursos, recurso, quantidadeAtual) {
  const gate = FEATURE_GATE[recurso];
  if (gate && !recursos?.[gate]) {
    return {
      allowed: false,
      reason: 'feature',
      message: 'Seu plano atual não inclui este recurso.',
      recurso,
    };
  }

  const limitKey = LIMIT_KEY_MAP[recurso];
  if (!limitKey) {
    return { allowed: true };
  }

  const limite = numericLimit(recursos, limitKey);
  if (limite == null) {
    return { allowed: true };
  }

  if (quantidadeAtual > limite) {
    return {
      allowed: false,
      reason: 'limit',
      message: `Você atingiu o limite de ${limite} ${recurso} do seu plano.`,
      recurso,
      limite,
    };
  }

  return { allowed: true };
}

export async function checkLimitForUser(usuarioId, recurso, quantidadeAtual) {
  const { recursos } = await getUserSubscriptionResources(usuarioId);
  return checkLimit(recursos, recurso, quantidadeAtual);
}

export async function assertCanUseResource(usuarioId, recurso) {
  const ok = await canUseResource(usuarioId, recurso);
  if (!ok) {
    throw new PlanAccessError('Seu plano atual não inclui este recurso.', {
      code: 'PLAN_FEATURE',
      recurso,
    });
  }
}

export async function assertWithinLimit(usuarioId, recurso, quantidadeAtual) {
  const { recursos } = await getUserSubscriptionResources(usuarioId);
  const result = checkLimit(recursos, recurso, quantidadeAtual);
  if (!result.allowed) {
    throw new PlanAccessError(result.message, {
      code: result.reason === 'limit' ? 'PLAN_LIMIT' : 'PLAN_FEATURE',
      recurso: result.recurso,
      limite: result.limite,
    });
  }
}

export async function assertOpenFinanceReal(usuarioId) {
  await assertCanUseResource(usuarioId, 'openFinance');
}

export async function assertIntegracaoPfPj(usuarioId) {
  await assertCanUseResource(usuarioId, 'integracaoPfPj');
}

export function requireFeature(recurso) {
  return async (req, res, next) => {
    try {
      await assertCanUseResource(req.user.id, recurso);
      next();
    } catch (err) {
      if (err instanceof PlanAccessError) {
        return res.status(err.status).json({
          error: err.message,
          code: err.code,
          recurso: err.recurso,
        });
      }
      next(err);
    }
  };
}

export function requireWithinLimit(recurso, getQuantidade) {
  return async (req, res, next) => {
    try {
      const q = typeof getQuantidade === 'function' ? await getQuantidade(req) : getQuantidade;
      await assertWithinLimit(req.user.id, recurso, q);
      next();
    } catch (err) {
      if (err instanceof PlanAccessError) {
        return res.status(err.status).json({
          error: err.message,
          code: err.code,
          recurso: err.recurso,
          limite: err.limite,
        });
      }
      next(err);
    }
  };
}

function activeEmpresa(dados) {
  if (!dados?.empresas?.length) return null;
  const idx = dados.empresaAtivaIndex ?? 0;
  return dados.empresas[idx] || dados.empresas[0];
}

function countArr(arr) {
  return Array.isArray(arr) ? arr.length : 0;
}

export function extractUsageFromDados(dados) {
  const emp = activeEmpresa(dados);
  if (!emp) {
    return {
      lancamentos: 0,
      clientes: 0,
      projetos: 0,
      centrosCusto: 0,
      fornecedores: 0,
    };
  }
  return {
    lancamentos: countArr(emp.lancamentos),
    clientes: countArr(emp.clientes),
    projetos: countArr(emp.projetos),
    centrosCusto: countArr(emp.centroCustos),
    fornecedores: countArr(emp.fornecedores),
  };
}

async function countWhatsappNumeros(usuarioId) {
  try {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS n FROM whatsapp_authorized_numbers WHERE usuario_id = $1`,
      [usuarioId]
    );
    return rows[0]?.n || 0;
  } catch {
    return 0;
  }
}

export async function getBillingUsage(usuarioId) {
  const bundle = await getUserSubscriptionResources(usuarioId);
  const { recursos, status, plano_slug, plano_nome } = bundle;

  const { rows: stRows } = await query('SELECT dados FROM estados WHERE usuario_id = $1', [
    usuarioId,
  ]);
  const uso = extractUsageFromDados(stRows[0]?.dados || {});
  uso.whatsappNumeros = await countWhatsappNumeros(usuarioId);

  const limites = {
    lancamentos: numericLimit(recursos, 'limiteLancamentos'),
    clientes: numericLimit(recursos, 'limiteClientes'),
    projetos: numericLimit(recursos, 'limiteProjetos'),
    centrosCusto: numericLimit(recursos, 'limiteCentrosCusto'),
    usuarios: numericLimit(recursos, 'limiteUsuarios'),
    whatsappNumeros: numericLimit(recursos, 'limiteWhatsappNumeros'),
  };

  const row = await fetchAssinaturaRow(usuarioId);
  const avisos = [
    ...buildLimiteAvisos({ recursos, totalLancamentos: uso.lancamentos }),
    ...buildBillingAvisos(row),
  ];

  if (status === 'atrasada') {
    avisos.push(
      'Pagamento em atraso. Regularize para evitar limitação de recursos premium. Seus dados permanecem salvos.'
    );
  }

  return {
    plano: { slug: plano_slug, nome: plano_nome },
    status,
    recursos,
    uso,
    limites,
    avisos: [...new Set(avisos)],
  };
}

function countNewIds(oldArr, newArr) {
  const oldIds = new Set((oldArr || []).map((x) => x?.id).filter(Boolean));
  let added = 0;
  for (const item of newArr || []) {
    if (item?.id && !oldIds.has(item.id)) added += 1;
    else if (!item?.id) added += 1;
  }
  return added;
}

/**
 * Valida incrementos no estado JSONB (PUT /api/state).
 * Não bloqueia edição/remoção de itens existentes.
 */
export async function validateStateSave(usuarioId, oldDados, newDados) {
  const { recursos } = await getUserSubscriptionResources(usuarioId);
  const oldEmp = activeEmpresa(oldDados);
  const newEmp = activeEmpresa(newDados);
  if (!newEmp) return { ok: true };

  const checks = [
    {
      recurso: 'lancamentos',
      oldLen: countArr(oldEmp?.lancamentos),
      newLen: countArr(newEmp.lancamentos),
      added: countNewIds(oldEmp?.lancamentos, newEmp.lancamentos),
    },
    {
      recurso: 'clientes',
      oldLen: countArr(oldEmp?.clientes),
      newLen: countArr(newEmp.clientes),
      added: countNewIds(oldEmp?.clientes, newEmp.clientes),
    },
    {
      recurso: 'projetos',
      oldLen: countArr(oldEmp?.projetos),
      newLen: countArr(newEmp.projetos),
      added: countNewIds(oldEmp?.projetos, newEmp.projetos),
    },
    {
      recurso: 'centrosCusto',
      oldLen: countArr(oldEmp?.centroCustos),
      newLen: countArr(newEmp.centroCustos),
      added: countNewIds(oldEmp?.centroCustos, newEmp.centroCustos),
    },
  ];

  for (const c of checks) {
    if (c.added <= 0) continue;

    const gate = FEATURE_GATE[c.recurso];
    if (gate && !recursos[gate]) {
      return {
        ok: false,
        error: 'Seu plano atual não inclui este recurso.',
        code: 'PLAN_FEATURE',
        recurso: c.recurso,
      };
    }

    const lim = checkLimit(recursos, c.recurso, c.newLen);
    if (!lim.allowed && c.newLen > c.oldLen) {
      return {
        ok: false,
        error: lim.message,
        code: lim.reason === 'limit' ? 'PLAN_LIMIT' : 'PLAN_FEATURE',
        recurso: lim.recurso,
        limite: lim.limite,
      };
    }
  }

  return { ok: true };
}

export function handlePlanAccessError(res, err) {
  if (err instanceof PlanAccessError) {
    return res.status(err.status).json({
      error: err.message,
      code: err.code,
      recurso: err.recurso,
      limite: err.limite,
    });
  }
  return null;
}

/** Helper WhatsApp — não bloqueia módulo; retorna info para UI. */
export async function getWhatsappPlanHint(usuarioId) {
  const { recursos } = await getUserSubscriptionResources(usuarioId);
  const uso = await countWhatsappNumeros(usuarioId);
  const lim = numericLimit(recursos, 'limiteWhatsappNumeros');
  return {
    usado: uso,
    limite: lim,
    podeAdicionar: lim == null || uso < lim,
    whatsappAudio: Boolean(recursos.whatsappAudio),
    whatsappComprovante: Boolean(recursos.whatsappComprovante),
  };
}
