import { randomUUID } from 'crypto';
import { roundMoney, reaisFromCentavos } from '../utils/money.js';

function resolveEmpresaAtiva(dados) {
  const empresas = Array.isArray(dados?.empresas) ? dados.empresas : [];
  if (!empresas.length) {
    const err = new Error('Estado do usuário sem empresa/perfil.');
    err.status = 422;
    throw err;
  }
  const activeId = dados.empresaAtivaId;
  let idx = activeId ? empresas.findIndex((e) => e.id === activeId) : -1;
  if (idx < 0) idx = 0;
  return { empresas, idx, empresa: empresas[idx] };
}

function validateConta(empresa, contaId) {
  if (!contaId || typeof contaId !== 'string') {
    const err = new Error('Campo contaId obrigatório para sincronizar.');
    err.status = 400;
    throw err;
  }
  const contas = Array.isArray(empresa.contas) ? empresa.contas : [];
  const conta = contas.find((c) => c.id === contaId && !c.inativo);
  if (!conta) {
    const err = new Error('Conta bancária inválida ou inativa.');
    err.status = 400;
    throw err;
  }
  return conta;
}

function validatePlano(empresa, planoId) {
  if (!planoId) return null;
  const planoContas = Array.isArray(empresa.planoContas) ? empresa.planoContas : [];
  const plano = planoContas.find((p) => p.id === planoId && !p.inativo);
  if (!plano) {
    const err = new Error('Categoria/plano inválido ou inativo.');
    err.status = 400;
    throw err;
  }
  return plano;
}

function nextCodigo(lancamentos) {
  const nums = (lancamentos || [])
    .map((l) => Number(l.codigo))
    .filter((n) => Number.isFinite(n) && n > 0);
  return nums.length ? Math.max(...nums) + 1 : 1;
}

/**
 * @param {object} tx - { amount_centavos, transaction_date, description }
 */
export function buildOpenFinanceLancamento(tx, {
  conta,
  contaId,
  planoId,
  codigo,
  connectionId,
  accountId,
  transactionId,
}) {
  const cents = Number(tx.amount_centavos);
  const isEntrada = cents > 0;
  const valor = roundMoney(Math.abs(reaisFromCentavos(Math.abs(cents))));
  const hist = String(tx.description || '').trim() || 'Open Finance';

  return {
    id: randomUUID(),
    codigo,
    data: tx.transaction_date,
    tipo: isEntrada ? 'Entrada' : 'Saida',
    valor,
    historico: hist,
    descricao: hist,
    planoId: planoId || '',
    contaEntradaId: isEntrada ? contaId : null,
    contaSaidaId: !isEntrada ? contaId : null,
    codigoDestino: isEntrada ? (conta.codigo ?? null) : null,
    codigoOrigem: !isEntrada ? (conta.codigo ?? null) : null,
    pago: true,
    lote: `OF-${String(connectionId).replace(/-/g, '').slice(0, 8)}`,
    tipoOrigem: '',
    tipoDestino: '',
    natureza: isEntrada ? 'Credito' : 'Debito',
    consiliado: false,
    exportado: false,
    clienteId: null,
    fornecedorId: null,
    centroCustoId: null,
    projetoId: null,
    createdAt: new Date().toISOString(),
    source: 'open_finance',
    openFinance: {
      connectionId,
      accountId,
      transactionId,
    },
  };
}

export function appendOpenFinanceLancamentos(dados, novosLancamentos) {
  const { empresas, idx, empresa } = resolveEmpresaAtiva(dados);
  const lancamentos = Array.isArray(empresa.lancamentos) ? [...empresa.lancamentos] : [];
  const novasEmpresas = empresas.map((e, i) =>
    i === idx ? { ...e, lancamentos: [...lancamentos, ...novosLancamentos] } : e
  );
  return { ...dados, empresas: novasEmpresas };
}

export function prepareSyncContext(dados, contaId, planoId) {
  const { empresa } = resolveEmpresaAtiva(dados);
  const conta = validateConta(empresa, contaId);
  validatePlano(empresa, planoId || null);
  const lancamentos = Array.isArray(empresa.lancamentos) ? empresa.lancamentos : [];
  return {
    empresa,
    conta,
    nextCodigo: () => nextCodigo(lancamentos),
    bumpCodigo: (() => {
      let codigo = nextCodigo(lancamentos);
      return () => {
        const c = codigo;
        codigo += 1;
        return c;
      };
    })(),
  };
}
