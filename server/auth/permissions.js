/**
 * Permissões multiusuário PJ — Etapa 6.7
 */
import { query } from '../db.js';

export const PERFIS_EMPRESA = ['owner', 'admin', 'financeiro', 'operador', 'leitura'];
export const PERFIS_CONVIDEIS = ['admin', 'financeiro', 'operador', 'leitura'];

/** Chaves de permissão usadas no backend e no menu. */
export const PERMISSION_KEYS = [
  'state.read',
  'state.write',
  'lancamentos.create',
  'lancamentos.edit',
  'clientes.manage',
  'relatorios.view',
  'contas.manage',
  'billing.view',
  'billing.manage',
  'equipe.view',
  'equipe.manage',
  'config.empresa',
  'config.seguranca',
  'integracao.view',
  'whatsapp.view',
  'openfinance.view',
  'projetos.view',
  'projetos.manage',
  'centro_custo.view',
  'importacoes.view',
  'recorrencias.view',
];

const PERFIL_PERMISSIONS = {
  owner: null,
  admin: new Set([
    'state.read',
    'state.write',
    'lancamentos.create',
    'lancamentos.edit',
    'clientes.manage',
    'relatorios.view',
    'contas.manage',
    'equipe.view',
    'equipe.manage',
    'config.empresa',
    'config.seguranca',
    'integracao.view',
    'whatsapp.view',
    'openfinance.view',
    'projetos.view',
    'projetos.manage',
    'centro_custo.view',
    'importacoes.view',
    'recorrencias.view',
  ]),
  financeiro: new Set([
    'state.read',
    'state.write',
    'lancamentos.create',
    'lancamentos.edit',
    'relatorios.view',
    'contas.manage',
    'config.seguranca',
    'integracao.view',
    'whatsapp.view',
    'openfinance.view',
    'projetos.view',
    'centro_custo.view',
    'importacoes.view',
    'recorrencias.view',
  ]),
  operador: new Set([
    'state.read',
    'state.write',
    'lancamentos.create',
    'lancamentos.edit',
    'clientes.manage',
    'relatorios.view',
    'config.seguranca',
    'importacoes.view',
    'recorrencias.view',
  ]),
  leitura: new Set([
    'state.read',
    'relatorios.view',
    'config.seguranca',
  ]),
};

/** Mapeamento item de menu → permissão mínima para exibir. */
export const MENU_PERMISSION_MAP = {
  dashboard: 'state.read',
  lancamentos: 'state.read',
  recorrencias: 'recorrencias.view',
  'contas-pagar': 'state.read',
  'resumo-anual': 'relatorios.view',
  dre: 'relatorios.view',
  contas: 'contas.manage',
  plano: 'contas.manage',
  impostos: 'relatorios.view',
  clientes: 'clientes.manage',
  projetos: 'projetos.view',
  'resultado-cliente': 'relatorios.view',
  'resultado-projeto': 'relatorios.view',
  fornecedores: 'state.read',
  importacoes: 'importacoes.view',
  conciliacao: 'relatorios.view',
  balancete: 'relatorios.view',
  fechamento: 'relatorios.view',
  'resultado-centro-custo': 'centro_custo.view',
  'orcado-realizado': 'relatorios.view',
  relatorios: 'relatorios.view',
  whatsapp: 'whatsapp.view',
  'integracao-pf-pj': 'integracao.view',
  'open-finance': 'openfinance.view',
  tutoriais: 'state.read',
  suporte: 'state.read',
  empresa: 'config.empresa',
  equipe: 'equipe.view',
  seguranca: 'config.seguranca',
  'plano-assinatura': 'billing.view',
};

export class PermissionError extends Error {
  constructor(message, { code = 'FORBIDDEN', status = 403, permission = null } = {}) {
    super(message);
    this.name = 'PermissionError';
    this.code = code;
    this.status = status;
    this.permission = permission;
  }
}

function permissionsForPerfil(perfil) {
  const set = PERFIL_PERMISSIONS[perfil];
  if (set === undefined && perfil !== 'owner') return new Set();
  if (perfil === 'owner' || set === null) return new Set(['*']);
  return set;
}

export function hasPermissionFromSet(permissionSet, permission) {
  if (!permissionSet || permissionSet.has('*')) return true;
  if (permissionSet.has(permission)) return true;
  const prefix = permission.split('.')[0];
  return permissionSet.has(`${prefix}.*`);
}

export async function resolveEmpresaContext(usuarioId) {
  const { rows: userRows } = await query(
    'SELECT id, email, nome, tipo_perfil, role FROM usuarios WHERE id = $1',
    [usuarioId]
  );
  const user = userRows[0];
  if (!user) {
    throw new PermissionError('Usuário não encontrado.', { status: 404 });
  }

  if (user.tipo_perfil === 'fisica') {
    const perms = permissionsForPerfil('owner');
    return {
      usuarioId: user.id,
      empresaOwnerId: user.id,
      perfil: 'owner',
      isOwner: true,
      isMember: false,
      tipoPerfil: 'fisica',
      permissions: [...perms],
      permissionSet: perms,
    };
  }

  const { rows: asMember } = await query(
    `SELECT empresa_usuario_id, perfil, status
     FROM empresa_usuarios
     WHERE membro_usuario_id = $1 AND status = 'ativo'
     ORDER BY created_at ASC
     LIMIT 1`,
    [usuarioId]
  );

  if (asMember.length) {
    const { empresa_usuario_id: ownerId, perfil } = asMember[0];
    const isOwner = ownerId === usuarioId && perfil === 'owner';
    const permissionSet = permissionsForPerfil(perfil);
    return {
      usuarioId: user.id,
      empresaOwnerId: ownerId,
      perfil,
      isOwner,
      isMember: ownerId !== usuarioId,
      tipoPerfil: 'juridica',
      permissions: [...permissionSet],
      permissionSet,
    };
  }

  await ensureEmpresaOwnerRow(usuarioId);
  const permissionSet = permissionsForPerfil('owner');
  return {
    usuarioId: user.id,
    empresaOwnerId: usuarioId,
    perfil: 'owner',
    isOwner: true,
    isMember: false,
    tipoPerfil: user.tipo_perfil || 'juridica',
    permissions: [...permissionSet],
    permissionSet,
  };
}

export async function ensureEmpresaOwnerRow(usuarioId) {
  const { rows } = await query(
    `SELECT tipo_perfil FROM usuarios WHERE id = $1`,
    [usuarioId]
  );
  if (rows[0]?.tipo_perfil !== 'juridica') return;

  await query(
    `INSERT INTO empresa_usuarios (empresa_usuario_id, membro_usuario_id, perfil, status)
     VALUES ($1, $1, 'owner', 'ativo')
     ON CONFLICT (empresa_usuario_id, membro_usuario_id) DO NOTHING`,
    [usuarioId]
  );
}

export async function getStateOwnerId(usuarioId) {
  const ctx = await resolveEmpresaContext(usuarioId);
  return ctx.empresaOwnerId;
}

export async function getUserPermissions(usuarioId) {
  const ctx = await resolveEmpresaContext(usuarioId);
  return {
    perfil: ctx.perfil,
    empresaOwnerId: ctx.empresaOwnerId,
    isOwner: ctx.isOwner,
    isMember: ctx.isMember,
    permissions: ctx.permissions,
    canWrite: hasPermissionFromSet(ctx.permissionSet, 'state.write'),
    viewOnly: !hasPermissionFromSet(ctx.permissionSet, 'state.write'),
  };
}

export async function hasPermission(usuarioId, permission) {
  const ctx = await resolveEmpresaContext(usuarioId);
  return hasPermissionFromSet(ctx.permissionSet, permission);
}

export function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      const ctx = req.empresaContext || (await resolveEmpresaContext(req.user.id));
      req.empresaContext = ctx;
      if (!hasPermissionFromSet(ctx.permissionSet, permission)) {
        return res.status(403).json({
          error: 'Você não tem permissão para esta ação.',
          code: 'FORBIDDEN',
          permission,
        });
      }
      next();
    } catch (err) {
      if (err instanceof PermissionError) {
        return res.status(err.status).json({ error: err.message, code: err.code });
      }
      next(err);
    }
  };
}

export async function attachEmpresaContext(req, res, next) {
  try {
    req.empresaContext = await resolveEmpresaContext(req.user.id);
    req.stateOwnerId = req.empresaContext.empresaOwnerId;
    next();
  } catch (err) {
    console.error('attachEmpresaContext:', err.message);
    res.status(500).json({ error: 'Erro ao resolver contexto da empresa.' });
  }
}

export function requireBillingAccess(req, res, next) {
  const ctx = req.empresaContext;
  if (!ctx) {
    return res.status(500).json({ error: 'Contexto da empresa não carregado.' });
  }
  if (!hasPermissionFromSet(ctx.permissionSet, 'billing.view')) {
    return res.status(403).json({
      error: 'Você não tem permissão para acessar cobrança e plano.',
      code: 'FORBIDDEN',
      permission: 'billing.view',
    });
  }
  next();
}

export function handlePermissionError(res, err) {
  if (err instanceof PermissionError) {
    res.status(err.status).json({
      error: err.message,
      code: err.code,
      permission: err.permission,
    });
    return true;
  }
  return false;
}
