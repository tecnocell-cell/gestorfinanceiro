/**
 * Multiusuário PJ — membros e convites (Etapa 6.7)
 */
import { randomBytes } from 'crypto';
import { query } from '../db.js';
import { assertUsuarioSlotsAvailable, PlanAccessError } from '../billing/accessControl.js';
import { PERFIS_CONVIDEIS, PermissionError, ensureEmpresaOwnerRow } from '../auth/permissions.js';

const CONVITE_TTL_DAYS = parseInt(process.env.EMPRESA_CONVITE_TTL_DAYS || '7', 10);

export async function countEmpresaUsuariosAtivos(empresaOwnerId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS n FROM empresa_usuarios
     WHERE empresa_usuario_id = $1 AND status = 'ativo'`,
    [empresaOwnerId]
  );
  return rows[0]?.n || 0;
}

async function countConvitesPendentes(empresaOwnerId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS n FROM convites_empresa
     WHERE empresa_usuario_id = $1 AND accepted_at IS NULL AND expires_at > NOW()`,
    [empresaOwnerId]
  );
  return rows[0]?.n || 0;
}

export async function countEmpresaUsuariosSlots(empresaOwnerId) {
  return (await countEmpresaUsuariosAtivos(empresaOwnerId)) + (await countConvitesPendentes(empresaOwnerId));
}

export async function assertPodeAdicionarMembro(empresaOwnerId, { modo = 'convite' } = {}) {
  const ativos = await countEmpresaUsuariosAtivos(empresaOwnerId);
  if (modo === 'aceite') {
    await assertUsuarioSlotsAvailable(empresaOwnerId, ativos + 1);
    return;
  }
  const pending = await countConvitesPendentes(empresaOwnerId);
  await assertUsuarioSlotsAvailable(empresaOwnerId, ativos + pending + 1);
}

function normalizePerfil(perfil) {
  const p = String(perfil || '').toLowerCase().trim();
  if (!PERFIS_CONVIDEIS.includes(p)) {
    throw new PermissionError(`Perfil inválido. Use: ${PERFIS_CONVIDEIS.join(', ')}.`, {
      status: 400,
    });
  }
  return p;
}

export async function listMembros(empresaOwnerId) {
  const { rows } = await query(
    `SELECT eu.id, eu.perfil, eu.status, eu.created_at,
            u.id AS membro_id, u.email, u.nome
     FROM empresa_usuarios eu
     JOIN usuarios u ON u.id = eu.membro_usuario_id
     WHERE eu.empresa_usuario_id = $1 AND eu.status != 'removido'
     ORDER BY
       CASE eu.perfil WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
       eu.created_at ASC`,
    [empresaOwnerId]
  );
  return rows.map(mapMembro);
}

function mapMembro(row) {
  return {
    id: row.id,
    membroUsuarioId: row.membro_id,
    email: row.email,
    nome: row.nome,
    perfil: row.perfil,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function convidarMembro({ empresaOwnerId, email, perfil, convidadoPorId }) {
  const perfilNorm = normalizePerfil(perfil);
  const emailNorm = String(email || '').toLowerCase().trim();
  if (!emailNorm || !emailNorm.includes('@')) {
    throw new PermissionError('Informe um e-mail válido.', { status: 400 });
  }

  await assertPodeAdicionarMembro(empresaOwnerId);

  const { rows: existingUser } = await query('SELECT id FROM usuarios WHERE email = $1', [
    emailNorm,
  ]);
  if (existingUser.length) {
    const membroId = existingUser[0].id;
    const { rows: dup } = await query(
      `SELECT id, status FROM empresa_usuarios
       WHERE empresa_usuario_id = $1 AND membro_usuario_id = $2`,
      [empresaOwnerId, membroId]
    );
    if (dup.length && dup[0].status === 'ativo') {
      throw new PermissionError('Este usuário já faz parte da equipe.', { status: 409 });
    }
    if (membroId === empresaOwnerId) {
      throw new PermissionError('O dono da conta já é membro owner.', { status: 400 });
    }
  }

  const { rows: pendingConvite } = await query(
    `SELECT id FROM convites_empresa
     WHERE empresa_usuario_id = $1 AND LOWER(email) = $2 AND accepted_at IS NULL AND expires_at > NOW()`,
    [empresaOwnerId, emailNorm]
  );
  if (pendingConvite.length) {
    throw new PermissionError('Já existe um convite pendente para este e-mail.', { status: 409 });
  }

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + CONVITE_TTL_DAYS);

  const { rows } = await query(
    `INSERT INTO convites_empresa (empresa_usuario_id, email, token, perfil, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, token, expires_at, perfil, email`,
    [empresaOwnerId, emailNorm, token, perfilNorm, expiresAt]
  );

  const { rows: ownerRows } = await query(
    'SELECT nome_perfil, nome FROM usuarios WHERE id = $1',
    [empresaOwnerId]
  );
  const empresaNome = ownerRows[0]?.nome_perfil || ownerRows[0]?.nome || 'sua empresa';

  return {
    convite: rows[0],
    empresaNome,
    convidadoPorId,
    devToken: process.env.NODE_ENV !== 'production' ? token : undefined,
  };
}

export async function aceitarConvite({ token, membroUsuarioId }) {
  const tokenNorm = String(token || '').trim();
  if (!tokenNorm) {
    throw new PermissionError('Token do convite é obrigatório.', { status: 400 });
  }

  const { rows: convRows } = await query(
    `SELECT c.*, u.email AS owner_email, u.nome_perfil AS empresa_nome
     FROM convites_empresa c
     JOIN usuarios u ON u.id = c.empresa_usuario_id
     WHERE c.token = $1`,
    [tokenNorm]
  );
  const convite = convRows[0];
  if (!convite) {
    throw new PermissionError('Convite não encontrado ou inválido.', { status: 404 });
  }
  if (convite.accepted_at) {
    throw new PermissionError('Este convite já foi aceito.', { status: 409 });
  }
  if (new Date(convite.expires_at) < new Date()) {
    throw new PermissionError('Convite expirado. Solicite um novo convite.', { status: 410 });
  }

  const { rows: membroRows } = await query('SELECT id, email, tipo_perfil FROM usuarios WHERE id = $1', [
    membroUsuarioId,
  ]);
  const membro = membroRows[0];
  if (!membro) {
    throw new PermissionError('Usuário não encontrado.', { status: 404 });
  }
  if (membro.email.toLowerCase() !== convite.email.toLowerCase()) {
    throw new PermissionError(
      'Este convite foi enviado para outro e-mail. Entre com a conta correta.',
      { status: 403 }
    );
  }

  await assertPodeAdicionarMembro(convite.empresa_usuario_id, { modo: 'aceite' });

  await query(
    `UPDATE convites_empresa SET accepted_at = NOW() WHERE id = $1`,
    [convite.id]
  );

  await query(
    `INSERT INTO empresa_usuarios (empresa_usuario_id, membro_usuario_id, perfil, status)
     VALUES ($1, $2, $3, 'ativo')
     ON CONFLICT (empresa_usuario_id, membro_usuario_id)
     DO UPDATE SET perfil = EXCLUDED.perfil, status = 'ativo'`,
    [convite.empresa_usuario_id, membroUsuarioId, convite.perfil]
  );

  await ensureEmpresaOwnerRow(convite.empresa_usuario_id);

  return {
    empresaOwnerId: convite.empresa_usuario_id,
    perfil: convite.perfil,
    empresaNome: convite.empresa_nome,
  };
}

export async function atualizarMembro({ empresaOwnerId, membroRowId, perfil, actorId }) {
  const perfilNorm = normalizePerfil(perfil);

  const { rows } = await query(
    `SELECT eu.*, u.email FROM empresa_usuarios eu
     JOIN usuarios u ON u.id = eu.membro_usuario_id
     WHERE eu.id = $1 AND eu.empresa_usuario_id = $2`,
    [membroRowId, empresaOwnerId]
  );
  const row = rows[0];
  if (!row) {
    throw new PermissionError('Membro não encontrado.', { status: 404 });
  }
  if (row.perfil === 'owner') {
    throw new PermissionError('Não é possível alterar o perfil do proprietário.', { status: 400 });
  }
  if (row.membro_usuario_id === actorId && perfilNorm !== row.perfil) {
    throw new PermissionError('Você não pode alterar seu próprio perfil.', { status: 400 });
  }

  await query(`UPDATE empresa_usuarios SET perfil = $1 WHERE id = $2`, [perfilNorm, membroRowId]);
  return mapMembro({ ...row, perfil: perfilNorm });
}

export async function removerMembro({ empresaOwnerId, membroRowId, actorId }) {
  const { rows } = await query(
    `SELECT * FROM empresa_usuarios WHERE id = $1 AND empresa_usuario_id = $2`,
    [membroRowId, empresaOwnerId]
  );
  const row = rows[0];
  if (!row) {
    throw new PermissionError('Membro não encontrado.', { status: 404 });
  }
  if (row.perfil === 'owner') {
    throw new PermissionError('Não é possível remover o proprietário da empresa.', { status: 400 });
  }
  if (row.membro_usuario_id === actorId) {
    throw new PermissionError('Use outra conta owner/admin para remover você mesmo.', {
      status: 400,
    });
  }

  await query(
    `UPDATE empresa_usuarios SET status = 'removido' WHERE id = $1`,
    [membroRowId]
  );
  return { ok: true };
}

export function isPlanAccessError(err) {
  return err instanceof PlanAccessError;
}
