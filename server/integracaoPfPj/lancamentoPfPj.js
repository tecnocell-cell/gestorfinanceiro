/**
 * Montagem e correção de lançamentos PF na integração PJ→PF.
 */
import { createInitialState } from '../initialState.js';
import { SOURCE_INTEGRACAO } from './estadoMerge.js';

const PREFERENCIA_PLANO_PF = {
  pro_labore: ['salário', 'salario', 'pró-labore', 'pro-labore', 'pro labore'],
  distribuicao_lucros: ['lucro', 'investimento', 'distribui', 'outros receb'],
  salario: ['salário', 'salario'],
  transferencia_pj_pf: ['transfer', 'outros receb', 'investimento', 'freelance'],
};

export function isPlanoReceita(plano) {
  if (!plano || plano.inativo) return false;
  if (plano.tipo === 'Receita') return true;
  if (String(plano.natureza || '').toLowerCase() === 'credito') return true;
  if (String(plano.classificacao || '').toUpperCase() === 'RECEITA') return true;
  return false;
}

export function isPlanoDespesaOuCusto(plano) {
  if (!plano || plano.inativo) return false;
  const t = String(plano.tipo || '');
  if (t === 'Despesa' || t === 'Custo' || t === 'Imposto') return true;
  if (String(plano.natureza || '').toLowerCase() === 'debito') return true;
  return false;
}

function planosReceitaFallback() {
  const st = createInitialState('fisica', 'Perfil');
  return (st.empresas[0].planoContas || []).filter(isPlanoReceita);
}

/** Apenas categorias de receita PF — nunca Custo/Despesa PJ. */
export function pickPlanoReceitaPf(empresa, tipoOperacao) {
  const planos = Array.isArray(empresa?.planoContas) ? empresa.planoContas : [];
  let receitas = planos.filter(isPlanoReceita);

  if (!receitas.length) {
    receitas = planosReceitaFallback();
  }

  if (!receitas.length) return null;

  const prefs = PREFERENCIA_PLANO_PF[tipoOperacao] || [];
  for (const kw of prefs) {
    const found = receitas.find((p) =>
      String(p.descricao || '').toLowerCase().includes(kw)
    );
    if (found) return found;
  }

  return receitas[0];
}

export function pickPlanoDespesaPj(empresa) {
  const planos = Array.isArray(empresa?.planoContas) ? empresa.planoContas : [];
  return (
    planos.find((p) => !p.inativo && (p.tipo === 'Despesa' || p.tipo === 'Custo'))
    || planos.find((p) => !p.inativo && isPlanoDespesaOuCusto(p))
    || null
  );
}

export function isLancamentoPfIntegracao(l) {
  return (
    String(l?.source || '') === SOURCE_INTEGRACAO &&
    (l?.integracaoPfPj?.lado === 'pf' || String(l?.historico || '').toLowerCase().includes('receb'))
  );
}

/**
 * Corrige lançamento PF da integração para Entrada + conta/plano corretos.
 */
export function repairLancamentoPfIntegracao(lanc, empresa, contas) {
  const contaId = lanc.contaEntradaId || lanc.contaSaidaId;
  const conta = (contas || []).find((c) => c.id === contaId) || (contas || []).find((c) => !c.inativo);
  const tipoOp =
    lanc.tipoOperacao ||
    lanc.integracaoPfPj?.tipoOperacao ||
    'transferencia_pj_pf';
  const plano = pickPlanoReceitaPf(empresa, tipoOp);

  const historico = lanc.historico || lanc.descricao || '';

  return {
    ...lanc,
    tipo: 'Entrada',
    historico,
    descricao: historico,
    valor: Math.abs(Number(lanc.valor)),
    natureza: 'Credito',
    contaEntradaId: conta?.id || contaId || null,
    contaSaidaId: null,
    codigoDestino: conta?.codigo ?? null,
    codigoOrigem: null,
    planoId: plano?.id || '',
    pago: lanc.pago !== false,
    source: SOURCE_INTEGRACAO,
  };
}

export function validateLancamentoPfIntegracao(lanc, empresa) {
  const erros = [];
  if (lanc.tipo !== 'Entrada') erros.push(`tipo=${lanc.tipo} (esperado Entrada)`);
  if (lanc.contaSaidaId) erros.push('contaSaidaId preenchido');
  if (!lanc.contaEntradaId) erros.push('contaEntradaId vazio');

  if (lanc.planoId && empresa?.planoContas) {
    const plano = empresa.planoContas.find((p) => p.id === lanc.planoId);
    if (plano && isPlanoDespesaOuCusto(plano)) {
      erros.push(`planoId aponta para ${plano.descricao} (${plano.tipo})`);
    }
  }

  return erros;
}
