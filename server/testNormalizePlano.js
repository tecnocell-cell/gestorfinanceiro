/**
 * Garante que normalizeStateForUser não descarta categorias de outras empresas (PF).
 * Uso: node server/testNormalizePlano.js
 */
import { normalizeStateForUser } from './initialState.js';

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

const catPj = {
  id: 'cat-pj-1',
  codigo: '9.9.001',
  classificacao: 'RECEITA',
  descricao: 'Categoria PJ custom',
  tipo: 'Receita',
  natureza: 'Credito',
  inativo: false,
};
const catPf = {
  id: 'cat-pf-1',
  codigo: '2.2',
  classificacao: 'DESPESA',
  descricao: 'Alimentação',
  tipo: 'Despesa',
  natureza: 'Debito',
  inativo: false,
};

const legado = {
  empresaAtivaId: 'emp-pf',
  empresas: [
    {
      id: 'emp-pj',
      tipo: 'juridica',
      nome: 'PJ legado',
      planoContas: [catPj],
      lancamentos: [],
      contas: [],
    },
    {
      id: 'emp-pf',
      tipo: 'fisica',
      nome: 'PF',
      planoContas: [catPf],
      lancamentos: [{ id: 'l1', valor: 10, tipo: 'Entrada', planoId: 'cat-pf-1' }],
      contas: [],
    },
  ],
};

console.log('=== testNormalizePlano ===\n');

const out = normalizeStateForUser(legado, {
  tipo_perfil: 'fisica',
  nome: 'PF Teste',
});

const planos = out.empresas[0].planoContas || [];
assert(out.empresas.length === 1, 'PF consolida em uma empresa');
assert(planos.length === 2, 'mantém categorias PJ + PF');
assert(planos.some((p) => p.id === 'cat-pj-1'), 'categoria da empresa PJ legado');
assert(planos.some((p) => p.id === 'cat-pf-1'), 'categoria da empresa PF');

console.log('\n=== testNormalizePlano: OK ===\n');
