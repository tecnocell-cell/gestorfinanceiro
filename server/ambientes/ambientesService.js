import { query } from '../db.js';
import { createInitialState } from '../initialState.js';

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
 * Injeta ambienteAtualId válido nos dados do estado.
 */
export function setAmbienteAtualNoEstado(dados, ambienteId) {
  return { ...dados, ambienteAtualId: ambienteId };
}

// ─── Fase 2: Isolamento real dos ambientes ────────────────────────────────────

/**
 * Mapeia tipo de ambiente para tipo_perfil do initialState.
 */
function tipoAmbienteToTipoPerfil(tipoAmbiente) {
  if (tipoAmbiente === 'pessoal') return 'fisica';
  return 'juridica'; // empresa | outro → PJ
}

/**
 * Cria estrutura de dados vazia para um novo ambiente.
 * Retorna o objeto empresas[0] (sem o wrapper { empresas, empresaAtivaId }).
 */
export function buildEmptyAmbienteData(tipoAmbiente, nome) {
  const tipoPerfil = tipoAmbienteToTipoPerfil(tipoAmbiente);
  const state = createInitialState(tipoPerfil, nome || 'Novo Ambiente');
  return state.empresas[0];
}

/**
 * Migra dados planos (estrutura antiga) para porAmbiente.
 * Idempotente: retorna o mesmo dados se porAmbiente já existir.
 */
export function migrateToMultiambiente(dados, ambienteAtualId) {
  if (dados.porAmbiente) return dados;
  const empresa = (dados.empresas || [])[0];
  if (!empresa || !ambienteAtualId) return dados;

  return {
    ...dados,
    porAmbiente: { [ambienteAtualId]: empresa },
  };
}

/**
 * Reconstrói dados.empresas como view do ambiente atual.
 * Deve ser chamado após migrateToMultiambiente.
 */
export function rebuildEmpresasView(dados) {
  if (!dados.porAmbiente || !dados.ambienteAtualId) return dados;

  let ambienteAtualId = dados.ambienteAtualId;
  let ambData = dados.porAmbiente[ambienteAtualId];

  if (!ambData) {
    // Fallback para primeiro disponível
    const firstId = Object.keys(dados.porAmbiente)[0];
    if (!firstId) return dados;
    ambienteAtualId = firstId;
    ambData = dados.porAmbiente[firstId];
  }

  return {
    ...dados,
    ambienteAtualId,
    empresas: [ambData],
    empresaAtivaId: ambData.id,
  };
}

/**
 * Sincroniza empresas[0] (após normalização) de volta para porAmbiente[ambienteAtualId].
 * Mantém porAmbiente e empresas[] sempre em sincronia.
 */
export function syncPortAmbienteFromView(dados) {
  if (!dados.porAmbiente || !dados.ambienteAtualId) return dados;
  const emp = (dados.empresas || [])[0];
  if (!emp) return dados;
  return {
    ...dados,
    porAmbiente: {
      ...dados.porAmbiente,
      [dados.ambienteAtualId]: emp,
    },
  };
}

/**
 * Aplica dados do ambiente atual (incoming PUT) ao estado armazenado,
 * preservando dados de outros ambientes.
 */
export function mergeAmbienteIntoStored(storedDados, incomingEmpresa, ambienteAtualId, filterPeriodo) {
  if (!incomingEmpresa || !ambienteAtualId) return storedDados;

  const basePorAmbiente = storedDados.porAmbiente || {};

  return {
    ...storedDados,
    porAmbiente: {
      ...basePorAmbiente,
      [ambienteAtualId]: incomingEmpresa,
    },
    empresas: [incomingEmpresa],
    empresaAtivaId: incomingEmpresa.id,
    ambienteAtualId,
    filterPeriodo: filterPeriodo || storedDados.filterPeriodo,
  };
}

/**
 * Inicializa porAmbiente[ambienteId] no estado do usuário com dados vazios.
 * Chamado ao criar novo ambiente.
 */
export async function initializeAmbienteInState(usuarioId, ambienteId, tipoAmbiente, nome) {
  const { rows } = await query(
    'SELECT dados FROM estados WHERE usuario_id = $1',
    [usuarioId]
  );
  if (!rows.length) return;

  const dados = rows[0].dados;
  const emptyData = buildEmptyAmbienteData(tipoAmbiente, nome);

  // Garante que porAmbiente existe (migra se necessário)
  const ambienteAtualId = dados.ambienteAtualId;
  let base = dados;
  if (!base.porAmbiente && ambienteAtualId && base.empresas?.[0]) {
    base = migrateToMultiambiente(base, ambienteAtualId);
    base = syncPortAmbienteFromView(base);
  }

  const updated = {
    ...base,
    porAmbiente: {
      ...(base.porAmbiente || {}),
      [ambienteId]: emptyData,
    },
  };

  await query(
    'UPDATE estados SET dados = $1, updated_at = NOW() WHERE usuario_id = $2',
    [JSON.stringify(updated), usuarioId]
  );
}
