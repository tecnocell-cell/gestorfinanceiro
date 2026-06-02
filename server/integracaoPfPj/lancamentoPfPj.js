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

const PREFERENCIA_PLANO_PJ = {
  pro_labore: ['pró-labore', 'pro-labore', 'pro labore', 'administrativ', 'despesa'],
  distribuicao_lucros: ['lucro', 'distribui', 'dividendo', 'resultado'],
  salario: ['salário', 'salario', 'folha', 'pessoal', 'remunera'],
  transferencia_pj_pf: ['transfer', 'moviment', 'sócio', 'socio', 'mutuo', 'mútuo'],
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

function planosDespesaFallback() {
  const st = createInitialState('juridica', 'Empresa');
  return (st.empresas[0].planoContas || []).filter(isPlanoDespesaOuCusto);
}

function pickPlanoPorPreferencia(planos, tipoOperacao, prefsMap) {
  const prefs = prefsMap[tipoOperacao] || [];
  for (const kw of prefs) {
    const found = planos.find((p) =>
      String(p.descricao || '').toLowerCase().includes(kw)
    );
    if (found) return found;
  }
  return planos[0] || null;
}

/** Apenas categorias de receita PF — nunca Custo/Despesa PJ. */
export function pickPlanoReceitaPf(empresa, tipoOperacao) {
  const planos = Array.isArray(empresa?.planoContas) ? empresa.planoContas : [];
  let receitas = planos.filter(isPlanoReceita);

  if (!receitas.length) {
    receitas = planosReceitaFallback();
  }

  if (!receitas.length) return null;

  return pickPlanoPorPreferencia(receitas, tipoOperacao, PREFERENCIA_PLANO_PF);
}

/** Categoria de despesa/custo PJ por tipo de operação — nunca receita/custo genérico errado na PF. */
export function pickPlanoDespesaPj(empresa, tipoOperacao = 'transferencia_pj_pf') {
  const planos = Array.isArray(empresa?.planoContas) ? empresa.planoContas : [];
  let despesas = planos.filter((p) => !p.inativo && isPlanoDespesaOuCusto(p));

  if (!despesas.length) {
    despesas = planosDespesaFallback();
  }

  if (!despesas.length) return null;

  return pickPlanoPorPreferencia(despesas, tipoOperacao, PREFERENCIA_PLANO_PJ);
}

export function snapshotPlanoCampos(plano, tipoLancamento) {
  if (!plano) {
    return {
      planoId: '',
      planoCodigo: '',
      planoDescricao: '',
      classificacao: tipoLancamento === 'Entrada' ? 'RECEITA' : 'DESPESA',
    };
  }
  return {
    planoId: plano.id,
    planoCodigo: plano.codigo ?? '',
    planoDescricao: plano.descricao ?? '',
    classificacao: plano.classificacao || (plano.tipo === 'Receita' ? 'RECEITA' : 'DESPESA'),
  };
}

export function isLancamentoPfIntegracao(l) {
  return (
    String(l?.source || '') === SOURCE_INTEGRACAO &&
    (l?.integracaoPfPj?.lado === 'pf' || String(l?.historico || '').toLowerCase().includes('receb'))
  );
}

/** Deduz tipo da operação a partir de campos gravados ou histórico. */
export function inferTipoOperacaoIntegracao(lanc) {
  const explicit = lanc?.tipoOperacao || lanc?.integracaoPfPj?.tipoOperacao;
  if (explicit && PREFERENCIA_PLANO_PJ[explicit]) return explicit;

  const h = String(lanc?.historico || lanc?.descricao || '').toLowerCase();
  if (/pr[oó][\s-]?labore|pro[\s-]?labore/.test(h)) return 'pro_labore';
  if (/sal[aá]rio/.test(h)) return 'salario';
  if (/lucro|distribui/.test(h)) return 'distribuicao_lucros';
  if (/transfer/.test(h)) return 'transferencia_pj_pf';
  return 'transferencia_pj_pf';
}

export function isLancamentoPjIntegracao(l) {
  return (
    String(l?.source || '') === SOURCE_INTEGRACAO &&
    (l?.integracaoPfPj?.lado === 'pj' || (!String(l?.historico || '').toLowerCase().includes('recebido') && !String(l?.historico || '').toLowerCase().includes('recebida')))
  );
}

/**
 * Corrige lançamento PF da integração para Entrada + conta/plano corretos.
 */
export function repairLancamentoPfIntegracao(lanc, empresa, contas, tipoOperacaoOverride) {
  const contaId = lanc.contaEntradaId || lanc.contaSaidaId;
  const conta = (contas || []).find((c) => c.id === contaId) || (contas || []).find((c) => !c.inativo);
  const tipoOp = tipoOperacaoOverride || inferTipoOperacaoIntegracao(lanc);
  const plano = pickPlanoReceitaPf(empresa, tipoOp);

  const historico = lanc.historico || lanc.descricao || '';

  return {
    ...lanc,
    tipo: 'Entrada',
    tipoOperacao: tipoOp,
    historico,
    descricao: historico,
    valor: Math.abs(Number(lanc.valor)),
    natureza: 'Credito',
    contaEntradaId: conta?.id || contaId || null,
    contaSaidaId: null,
    codigoDestino: conta?.codigo ?? null,
    codigoOrigem: null,
    ...snapshotPlanoCampos(plano, 'Entrada'),
    pago: lanc.pago !== false,
    source: SOURCE_INTEGRACAO,
    integracaoPfPj: {
      ...(lanc.integracaoPfPj || {}),
      tipoOperacao: tipoOp,
      lado: 'pf',
    },
  };
}

export function repairLancamentoPjIntegracao(lanc, empresa, contas, tipoOperacaoOverride) {
  const contaId = lanc.contaSaidaId || lanc.contaEntradaId;
  const conta = (contas || []).find((c) => c.id === contaId) || (contas || []).find((c) => !c.inativo);
  const tipoOp = tipoOperacaoOverride || inferTipoOperacaoIntegracao(lanc);
  const plano = pickPlanoDespesaPj(empresa, tipoOp);
  const historico = lanc.historico || lanc.descricao || '';

  return {
    ...lanc,
    tipo: 'Saida',
    tipoOperacao: tipoOp,
    historico,
    descricao: historico,
    valor: Math.abs(Number(lanc.valor)),
    natureza: 'Debito',
    contaSaidaId: conta?.id || contaId || null,
    contaEntradaId: null,
    codigoOrigem: conta?.codigo ?? null,
    codigoDestino: null,
    ...snapshotPlanoCampos(plano, 'Saida'),
    pago: lanc.pago !== false,
    source: SOURCE_INTEGRACAO,
    integracaoPfPj: {
      ...(lanc.integracaoPfPj || {}),
      tipoOperacao: tipoOp,
      lado: 'pj',
    },
  };
}

export function validateLancamentoPjIntegracao(lanc, empresa) {
  const erros = [];
  if (lanc.tipo !== 'Saida') erros.push(`tipo=${lanc.tipo} (esperado Saida)`);
  if (lanc.contaEntradaId) erros.push('contaEntradaId preenchido');
  if (!lanc.contaSaidaId) erros.push('contaSaidaId vazio');
  if (!lanc.planoId && !lanc.planoDescricao) erros.push('sem discriminação (plano)');

  if (lanc.planoId && empresa?.planoContas) {
    const plano = empresa.planoContas.find((p) => p.id === lanc.planoId);
    if (plano && isPlanoReceita(plano)) {
      erros.push(`planoId aponta para receita ${plano.descricao}`);
    }
  }

  return erros;
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
