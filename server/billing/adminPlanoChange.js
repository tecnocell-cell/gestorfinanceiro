import { query } from '../db.js';
import {
  getPlanoBySlug,
  ensureAssinaturaPadrao,
  getAssinaturaUsuario,
} from './subscriptions.js';
import { planoMatchesTipoPerfil } from './planResources.js';

export async function insertAdminSaasAudit({
  adminUsuarioId,
  alvoUsuarioId,
  acao,
  detalhes = {},
}) {
  await query(
    `INSERT INTO admin_saas_auditoria (admin_usuario_id, alvo_usuario_id, acao, detalhes)
     VALUES ($1, $2, $3, $4)`,
    [adminUsuarioId || null, alvoUsuarioId, acao, JSON.stringify(detalhes)]
  );
}

/**
 * Altera plano da assinatura pelo admin (sem cobrança automática).
 */
export async function adminChangeClientePlano({
  alvoUsuarioId,
  planoSlug,
  adminUsuarioId,
}) {
  const slug = String(planoSlug || '').trim().toLowerCase();
  if (!slug) return { ok: false, error: 'Informe o novo plano.' };

  const plano = await getPlanoBySlug(slug);
  if (!plano) return { ok: false, error: 'Plano não encontrado.' };

  const { rows: uRows } = await query(
    `SELECT id, tipo_perfil, role FROM usuarios WHERE id = $1`,
    [alvoUsuarioId]
  );
  const user = uRows[0];
  if (!user) return { ok: false, error: 'Cliente não encontrado.' };
  if (user.role === 'admin') return { ok: false, error: 'Não é possível alterar plano de administrador.' };

  if (!planoMatchesTipoPerfil(plano.slug, user.tipo_perfil)) {
    return { ok: false, error: 'Plano incompatível com o tipo de perfil (PF/PJ).' };
  }

  await ensureAssinaturaPadrao(alvoUsuarioId);

  const { rows: before } = await query(
    `SELECT a.id, a.plano_id, a.status, p.slug AS plano_slug
     FROM assinaturas a
     JOIN planos p ON p.id = a.plano_id
     WHERE a.usuario_id = $1`,
    [alvoUsuarioId]
  );
  const prev = before[0];

  await query(
    `UPDATE assinaturas SET plano_id = $1, updated_at = NOW() WHERE usuario_id = $2`,
    [plano.id, alvoUsuarioId]
  );

  await insertAdminSaasAudit({
    adminUsuarioId,
    alvoUsuarioId,
    acao: 'alterar_plano',
    detalhes: {
      plano_anterior: prev?.plano_slug || null,
      plano_novo: slug,
      status_assinatura: prev?.status || null,
    },
  });

  const assinatura = await getAssinaturaUsuario(alvoUsuarioId);
  return {
    ok: true,
    message: `Plano alterado para ${plano.nome}.`,
    assinatura,
  };
}
