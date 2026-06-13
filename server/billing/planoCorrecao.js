/**
 * Corrige assinatura quando slug do plano não combina com tipo_perfil (PJ x PF).
 */
import { query } from '../db.js';

const PJ_TARGET_BY_ORIG = {
  free: 'pj_start',
  pf_basico: 'pj_start',
  pro: 'pj_pro',
  pf_plus: 'pj_pro',
  pf_premium: 'pj_business',
  empresarial: 'pj_business',
};

// Modelo Fluxiva unificado: usuários 'fisica' podem manter planos pj_* (cross-ambiente).
// Não há mais correção automática de segmento para PF — qualquer plano ativo é válido.
const PF_TARGET_BY_ORIG = {};

export async function corrigirAssinaturaSegmento(usuarioId) {
  const { rows } = await query(
    `SELECT a.id AS assinatura_id, u.tipo_perfil, p.slug AS plano_slug
     FROM assinaturas a
     JOIN usuarios u ON u.id = a.usuario_id
     JOIN planos p ON p.id = a.plano_id
     WHERE a.usuario_id = $1`,
    [usuarioId]
  );
  const row = rows[0];
  if (!row) return null;

  const map =
    row.tipo_perfil === 'juridica'
      ? PJ_TARGET_BY_ORIG
      : row.tipo_perfil === 'fisica'
        ? PF_TARGET_BY_ORIG
        : null;
  if (!map) return null;

  const targetSlug = map[row.plano_slug];
  if (!targetSlug) return null;

  const { rows: dest } = await query(
    `SELECT id FROM planos WHERE slug = $1 AND ativo = true`,
    [targetSlug]
  );
  if (!dest.length) return null;

  await query(
    `UPDATE assinaturas SET plano_id = $1, updated_at = NOW()
     WHERE id = $2 AND plano_id IS DISTINCT FROM $1`,
    [dest[0].id, row.assinatura_id]
  );

  return targetSlug;
}
