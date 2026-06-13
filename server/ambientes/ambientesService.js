import { query } from '../db.js';

/**
 * Garante que o usuário tem ao menos um ambiente financeiro.
 * Idempotente — seguro chamar em toda requisição de estado.
 */
export async function ensureAmbientePrincipal(usuarioId, tipoPerfil, nomePerfil) {
  const { rows } = await query(
    `SELECT id FROM ambientes_financeiros WHERE usuario_id = $1 AND ativo = true LIMIT 1`,
    [usuarioId]
  );
  if (rows.length) return rows[0];

  const nome = nomePerfil?.trim() || (tipoPerfil === 'fisica' ? 'Pessoal' : 'Empresa');
  const tipo = tipoPerfil === 'fisica' ? 'pessoal' : 'empresa';

  const { rows: created } = await query(
    `INSERT INTO ambientes_financeiros (usuario_id, nome, tipo, ordem)
     VALUES ($1, $2, $3, 0)
     ON CONFLICT DO NOTHING
     RETURNING id, nome, tipo, ordem, created_at`,
    [usuarioId, nome, tipo]
  );

  if (created.length) return created[0];

  // Caso de corrida — busca o que foi criado pela outra request
  const { rows: existing } = await query(
    `SELECT id FROM ambientes_financeiros WHERE usuario_id = $1 AND ativo = true LIMIT 1`,
    [usuarioId]
  );
  return existing[0] || null;
}

/**
 * Lista todos os ambientes ativos do usuário, ordenados.
 */
export async function listAmbientes(usuarioId) {
  const { rows } = await query(
    `SELECT id, nome, tipo, icone, cor, ordem, created_at
     FROM ambientes_financeiros
     WHERE usuario_id = $1 AND ativo = true
     ORDER BY ordem ASC, created_at ASC`,
    [usuarioId]
  );
  return rows;
}

/**
 * Retorna o ambiente principal (menor ordem, mais antigo).
 */
export async function getAmbientePrincipal(usuarioId) {
  const { rows } = await query(
    `SELECT id, nome, tipo, icone, cor, ordem
     FROM ambientes_financeiros
     WHERE usuario_id = $1 AND ativo = true
     ORDER BY ordem ASC, created_at ASC
     LIMIT 1`,
    [usuarioId]
  );
  return rows[0] || null;
}

/**
 * Cria um novo ambiente financeiro.
 */
export async function createAmbiente(usuarioId, { nome, tipo = 'outro', icone, cor }) {
  if (!nome?.trim()) throw new Error('Nome do ambiente é obrigatório.');

  const { rows: count } = await query(
    `SELECT COUNT(*) AS n FROM ambientes_financeiros WHERE usuario_id = $1 AND ativo = true`,
    [usuarioId]
  );
  const ordem = parseInt(count[0].n, 10);

  const { rows } = await query(
    `INSERT INTO ambientes_financeiros (usuario_id, nome, tipo, icone, cor, ordem)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, nome, tipo, icone, cor, ordem, created_at`,
    [usuarioId, nome.trim(), tipo, icone || null, cor || null, ordem]
  );
  return rows[0];
}

/**
 * Injeta ambienteAtualId válido nos dados do estado, sem modificar dados financeiros.
 * Retorna os dados com ambienteAtualId garantidamente preenchido.
 */
export function setAmbienteAtualNoEstado(dados, ambienteId) {
  return { ...dados, ambienteAtualId: ambienteId };
}
