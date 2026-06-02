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
  if (operacaoId && l.integracaoPfPj?.operacaoId) {
    return String(l.integracaoPfPj.operacaoId) === String(operacaoId);
  }
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
