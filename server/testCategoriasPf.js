/**
 * PF não pode ficar só com Receitas Operacionais + Despesas Administrativas
 * se existirem categorias PF históricas.
 * Uso: npm run test:categorias-pf
 */
import { normalizeStateForUser } from './initialState.js';
import {
  isSomenteAssinaturasPjPadrao,
  selectPlanoContasForPf,
  isPlanoContasPJ,
} from '../src/gestor/categoriasPfUtils.js';

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

function defaultCategoriasPF() {
  return [
    { id: 'pf-sal', codigo: '1.1', descricao: 'Salário', tipo: 'Receita', classificacao: 'RECEITA', natureza: 'Credito', inativo: false },
    { id: 'pf-ali', codigo: '2.2', descricao: 'Alimentação', tipo: 'Despesa', classificacao: 'DESPESA', natureza: 'Debito', inativo: false },
  ];
}

const pjReceita = {
  id: 'pj-rec',
  codigo: '1.1.001',
  descricao: 'Receitas Operacionais',
  tipo: 'Receita',
  classificacao: 'RECEITA',
  natureza: 'Credito',
  inativo: false,
};
const pjDespesa = {
  id: 'pj-desp',
  codigo: '3.1.001',
  descricao: 'Despesas Administrativas',
  tipo: 'Despesa',
  classificacao: 'DESPESA',
  natureza: 'Debito',
  inativo: false,
};

console.log('=== test:categorias-pf ===\n');

assert(
  isSomenteAssinaturasPjPadrao([pjReceita, pjDespesa]),
  'detecta sintoma só PJ padrão'
);

const legadoQuebrado = {
  empresaAtivaId: 'emp1',
  empresas: [
    {
      id: 'emp1',
      tipo: 'fisica',
      nome: 'PF',
      planoContas: [pjReceita, pjDespesa],
      lancamentos: [{ id: 'l1', planoId: 'pj-rec', valor: 100, tipo: 'Entrada' }],
      contas: [],
    },
  ],
};

const histPf = {
  empresaAtivaId: 'emp-pf',
  empresas: [
    { id: 'emp-pj', tipo: 'juridica', planoContas: [pjReceita, pjDespesa], lancamentos: [], contas: [] },
    {
      id: 'emp-pf',
      tipo: 'fisica',
      planoContas: [{ id: 'cat-hist', codigo: '2.3', descricao: 'Transporte', tipo: 'Despesa', classificacao: 'DESPESA', natureza: 'Debito', inativo: false }],
      lancamentos: [],
      contas: [],
    },
  ],
};

const outHist = normalizeStateForUser(legadoQuebrado, { tipo_perfil: 'fisica', nome: 'PF' });
const planosHist = outHist.empresas[0].planoContas || [];
assert(
  !isSomenteAssinaturasPjPadrao(planosHist.filter((p) => !p.inativo)),
  'normalização restaura PF quando só PJ padrão (via defaults)'
);
assert(
  planosHist.some((p) => p.descricao === 'Salário' || p.descricao === 'Transporte'),
  'contém categoria PF após normalizar estado quebrado'
);

const outMerge = normalizeStateForUser(histPf, { tipo_perfil: 'fisica', nome: 'PF' });
const planosMerge = outMerge.empresas[0].planoContas || [];
assert(
  planosMerge.some((p) => p.id === 'cat-hist'),
  'preserva Transporte histórico do slot PF'
);
assert(
  planosMerge.filter((p) => !isPlanoContasPJ(p)).length >= 2,
  'mantém múltiplas categorias PF'
);

const selected = selectPlanoContasForPf(
  [pjReceita, pjDespesa],
  legadoQuebrado.empresas,
  legadoQuebrado.empresas[0].lancamentos,
  defaultCategoriasPF
);
assert(
  !isSomenteAssinaturasPjPadrao(selected),
  'selectPlanoContasForPf não deixa só PJ padrão'
);

console.log('\n=== test:categorias-pf: OK ===\n');
