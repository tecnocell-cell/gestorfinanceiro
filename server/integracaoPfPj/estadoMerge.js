/**
 * Merge seguro de estados JSONB — preserva 100% dos dados ao integrar PF/PJ.
 * PF: consolida todas as empresas (mesma regra do GET /api/state) antes de mutar.
 */

import { normalizeStateForUser } from '../initialState.js';
import { normalizeTipoPerfil } from '../profileTipo.js';

export const SOURCE_INTEGRACAO = 'integracao_pf_pj';

export function parseEstadoDados(dados) {
  if (dados == null) return null;
  if (typeof dados === 'string') {
    try {
      return JSON.parse(dados);
    } catch {
      return null;
    }
  }
  return dados;
}

export function toUserProfile(row) {
  if (!row) return { tipo_perfil: 'juridica' };
  return {
    tipo_perfil: normalizeTipoPerfil(row.tipo_perfil),
    nome_perfil: row.nome_perfil || row.nome,
    nome: row.nome,
  };
}

export function profileForPf(userRow, fallbackNome) {
  return {
    tipo_perfil: 'fisica',
    nome_perfil: userRow?.nome_perfil || userRow?.nome || fallbackNome,
    nome: userRow?.nome,
  };
}

export function profileForPj(userRow, fallbackNome) {
  return {
    tipo_perfil: 'juridica',
    nome_perfil: userRow?.nome_perfil || userRow?.nome || fallbackNome,
    nome: userRow?.nome,
  };
}

/** Normaliza PF (merge multi-empresa) / alinha PJ antes de qualquer escrita. */
export function prepareEstadoForWrite(dados, userProfile) {
  const parsed = parseEstadoDados(dados);
  if (!parsed || !Array.isArray(parsed.empresas) || !parsed.empresas.length) {
    const err = new Error('Estado inválido ou vazio.');
    err.status = 422;
    throw err;
  }
  return normalizeStateForUser(parsed, toUserProfile(userProfile));
}

export function resolveEmpresaAtiva(dados) {
  const empresas = Array.isArray(dados?.empresas) ? dados.empresas : [];
  if (!empresas.length) {
    const err = new Error('Estado sem empresa/perfil.');
    err.status = 422;
    throw err;
  }
  const activeId = dados.empresaAtivaId;
  let idx = activeId ? empresas.findIndex((e) => e.id === activeId) : -1;
  if (idx < 0) idx = 0;
  return { empresas, idx, empresa: empresas[idx] };
}

export function collectAllLancamentos(dados) {
  const parsed = parseEstadoDados(dados);
  if (!parsed?.empresas) return [];
  return parsed.empresas.flatMap((e) => e.lancamentos || []);
}

export function appendLancamentoToEstado(dados, lancamento, userProfile) {
  const prepared = prepareEstadoForWrite(dados, userProfile);
  const { empresas, idx } = resolveEmpresaAtiva(prepared);
  const novasEmpresas = empresas.map((e, i) =>
    i === idx
      ? { ...e, lancamentos: [...(e.lancamentos || []), lancamento] }
      : e
  );
  return { ...prepared, empresas: novasEmpresas };
}

function shouldRemoveIntegracaoLancamento(l, lancamentoId, operacaoId) {
  if (String(l.id) !== String(lancamentoId)) return false;
  if (String(l.source || '') !== SOURCE_INTEGRACAO) return false;
  return true;
}

export function removeIntegracaoLancamento(dados, { lancamentoId, operacaoId }, userProfile) {
  const prepared = prepareEstadoForWrite(dados, userProfile);
  let removidos = 0;

  const empresas = prepared.empresas.map((emp) => {
    const lancamentos = Array.isArray(emp.lancamentos) ? emp.lancamentos : [];
    const filtrados = lancamentos.filter((l) => {
      const remove = shouldRemoveIntegracaoLancamento(l, lancamentoId, operacaoId);
      if (remove) removidos += 1;
      return !remove;
    });
    if (filtrados.length === lancamentos.length) return emp;
    return { ...emp, lancamentos: filtrados };
  });

  return { novosDados: { ...prepared, empresas }, removidos };
}

/**
 * Remove lançamentos da integração PJ↔PF (rollback bilateral).
 * Por ID oficial da operação e/ou por integracaoPfPj.operacaoId em todas as empresas.
 */
export function removeIntegracaoOperacaoFromEstado(dados, {
  operacaoId,
  lancamentoPjId,
  lancamentoPfId,
}) {
  const parsed = parseEstadoDados(dados);
  if (!parsed?.empresas?.length) {
    return { novosDados: dados, removidos: 0 };
  }

  const ids = new Set(
    [lancamentoPjId, lancamentoPfId].filter(Boolean).map((id) => String(id))
  );
  const opId = operacaoId ? String(operacaoId) : null;
  let removidos = 0;

  const empresas = parsed.empresas.map((emp) => {
    const lancamentos = Array.isArray(emp.lancamentos) ? emp.lancamentos : [];
    const filtrados = lancamentos.filter((l) => {
      if (String(l.source || '') !== SOURCE_INTEGRACAO) return true;
      const byId = ids.has(String(l.id));
      const byOp = opId && String(l.integracaoPfPj?.operacaoId || '') === opId;
      const remove = byId || byOp;
      if (remove) removidos += 1;
      return !remove;
    });
    if (filtrados.length === lancamentos.length) return emp;
    return { ...emp, lancamentos: filtrados };
  });

  return { novosDados: { ...parsed, empresas }, removidos };
}

export function removeIntegracaoOperacaoPrepared(dados, opts, userProfile) {
  const { novosDados, removidos } = removeIntegracaoOperacaoFromEstado(dados, opts);
  return {
    novosDados: prepareEstadoForWrite(novosDados, userProfile),
    removidos,
  };
}

/** IDs de lançamentos cuja operação já foi desfeita (rollback) — não podem voltar via PUT do cliente. */
export async function fetchRollbackIntegracaoLancamentoIds(dbQuery, usuarioId) {
  const { rows } = await dbQuery(
    `SELECT o.lancamento_pj_id, o.lancamento_pf_id
     FROM integracao_pf_pj_operacoes o
     JOIN integracao_pf_pj_vinculo v ON v.id = o.vinculo_id
     WHERE o.status = 'rollback'
       AND (v.usuario_pj_id = $1 OR v.usuario_pf_id = $1)`,
    [usuarioId]
  );
  const ids = new Set();
  for (const r of rows) {
    if (r.lancamento_pj_id) ids.add(String(r.lancamento_pj_id));
    if (r.lancamento_pf_id) ids.add(String(r.lancamento_pf_id));
  }
  return ids;
}

/**
 * Preserva lançamentos integracao_pf_pj do servidor ao salvar estado do cliente.
 * Evita auto-save PF sobrescrever valor/entrada após confirmação PJ.
 */
export function preserveIntegracaoLancamentosFromServer(serverDados, clientDados) {
  const server = parseEstadoDados(serverDados);
  const client = parseEstadoDados(clientDados);
  if (!server?.empresas?.length || !client?.empresas?.length) return clientDados;

  const serverById = new Map();
  for (const emp of server.empresas) {
    for (const l of emp.lancamentos || []) {
      if (String(l.source || '') === SOURCE_INTEGRACAO) {
        serverById.set(String(l.id), l);
      }
    }
  }

  if (!serverById.size) return clientDados;

  const presentIds = new Set();
  const empresas = client.empresas.map((emp) => {
    const lancamentos = (emp.lancamentos || [])
      .map((l) => {
        if (String(l.source || '') !== SOURCE_INTEGRACAO) return l;
        const srv = serverById.get(String(l.id));
        if (srv) {
          presentIds.add(String(l.id));
          return srv;
        }
        return null;
      })
      .filter(Boolean);
    return { ...emp, lancamentos };
  });

  const missing = [...serverById.values()].filter((l) => !presentIds.has(String(l.id)));
  if (missing.length) {
    const { idx } = resolveEmpresaAtiva({ ...client, empresas });
    const target = empresas[idx];
    empresas[idx] = {
      ...target,
      lancamentos: [...(target.lancamentos || []), ...missing],
    };
  }

  return { ...client, empresas };
}

/** Remove do estado lançamentos de operações já desfeitas (evita auto-save PF ressuscitar entrada). */
export function stripLancamentosIntegracaoRollback(dados, rollbackIds) {
  if (!rollbackIds?.size) return dados;
  const parsed = parseEstadoDados(dados);
  if (!parsed?.empresas?.length) return dados;

  const empresas = parsed.empresas.map((emp) => {
    const lancamentos = (emp.lancamentos || []).filter(
      (l) => !rollbackIds.has(String(l.id))
    );
    if (lancamentos.length === (emp.lancamentos || []).length) return emp;
    return { ...emp, lancamentos };
  });

  return { ...parsed, empresas };
}
