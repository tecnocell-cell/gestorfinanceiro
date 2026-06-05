/**
 * Testes — conta padrão, saldo e recorrências
 * npm run test:finance-account-balance
 */
import {
  getContaPadrao,
  getSaldoConta,
  getSaldoTotal,
  calcTotaisResultadoPeriodo,
  auditLancamentosSemConta,
  patchContaLancamentoPago,
  reaisFromCentavos,
  safeNum,
  isTransferenciaInterna,
} from '../src/gestor/finance.js';
import {
  buildLancamentoFromRecorrencia as buildFromRec,
  resolveContaIdRecorrencia as resolveRecConta,
} from '../src/gestor/recorrenciasLancamentos.js';

const ANO = '2026';
const MES = '06';
const PERIODO = { ano: ANO, mes: MES };

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

const contas = [
  { id: 'caixa1', codigo: 1, nome: 'Carteira', apelido: 'Caixa', tipo: 'Caixa', saldoInicial: 0, inativo: false },
  { id: 'banco1', codigo: 2, nome: 'Conta Corrente', tipo: 'Banco', saldoInicial: 0, inativo: false },
];

function lancTransferPf({ id, valor, contaId = 'caixa1' }) {
  return {
    id,
    tipo: 'Entrada',
    valor,
    historico: 'Transferência recebida — Empresa PJ',
    data: `${ANO}-${MES}-05`,
    status: 'pago',
    pago: true,
    dataPagamento: `${ANO}-${MES}-05`,
    source: 'integracao_pf_pj',
    tipoOperacao: 'transferencia_pj_pf',
    integracaoPfPj: { tipoOperacao: 'transferencia_pj_pf', lado: 'pf' },
    contaEntradaId: contaId,
  };
}

function main() {
  console.log('=== test:finance-account-balance ===\n');

  console.log('— getContaPadrao —');
  const padrao = getContaPadrao(contas);
  assert(padrao?.id === 'caixa1', 'conta padrão é Caixa');

  console.log('\n— recorrência Saída sem conta_id gera com Caixa —');
  const recDesp = {
    id: 'rec-ped',
    tipo: 'Despesa',
    descricao: 'Pedreiro',
    valor: 2500,
    proxima_data: `${ANO}-${MES}-10`,
    status: 'ativa',
    plano_id: 'p1',
  };
  const contaRec = resolveRecConta(recDesp, contas);
  assert(contaRec === 'caixa1', 'recorrência sem conta_id usa Caixa');
  const lancGerado = buildFromRec({
    recorrencia: recDesp,
    lancamentos: [],
    contas,
    generateId: () => 'lanc-ped',
  });
  assert(lancGerado.contaSaidaId === 'caixa1', 'lançamento gerado com contaSaidaId Caixa');
  assert(lancGerado.source === 'recorrencia', 'source recorrencia');

  console.log('\n— recorrência com conta Banco —');
  const recBanco = { ...recDesp, id: 'rec-fin', descricao: 'Financiamento', conta_id: 'banco1' };
  const lancBanco = buildFromRec({
    recorrencia: recBanco,
    lancamentos: [],
    contas,
    generateId: () => 'lanc-fin',
  });
  assert(lancBanco.contaSaidaId === 'banco1', 'recorrência com conta Banco reduz Banco');

  console.log('\n— saldo: repasse + duas despesas recorrentes —');
  const cenario = [
    lancTransferPf({ id: 'tr1', valor: 20000 }),
    { ...lancBanco, status: 'pago', pago: true, dataPagamento: `${ANO}-${MES}-08`, recorrenciaId: recBanco.id },
    {
      ...lancGerado,
      status: 'pago',
      pago: true,
      dataPagamento: `${ANO}-${MES}-08`,
      recorrenciaId: recDesp.id,
      contaSaidaId: null,
      codigoOrigem: null,
    },
  ];
  const saldoCaixa = getSaldoConta('caixa1', contas, cenario);
  const saldoBanco = getSaldoConta('banco1', contas, cenario);
  const saldoTotal = getSaldoTotal(contas, cenario);
  assert(saldoCaixa === 17500, `Caixa: 20.000 - 2.500 pedreiro = 17.500 (obteve ${saldoCaixa})`);
  assert(saldoBanco === -2500, `Banco: -2.500 financiamento (obteve ${saldoBanco})`);
  assert(saldoTotal === 15000, `Saldo total R$ 15.000 (obteve ${saldoTotal})`);

  console.log('\n— manual pago sem conta: resultado sim, saldo não —');
  const manualSemConta = {
    id: 'man1',
    tipo: 'Saida',
    valor: 1000,
    historico: 'Manual avulso',
    data: `${ANO}-${MES}-12`,
    status: 'pago',
    pago: true,
    dataPagamento: `${ANO}-${MES}-12`,
  };
  const cManual = [lancTransferPf({ id: 'tr2', valor: 5000 }), manualSemConta];
  const totais = calcTotaisResultadoPeriodo(cManual, PERIODO);
  const saldoManual = getSaldoTotal(contas, cManual);
  assert(totais.despesas === 1000, 'manual entra no resultado');
  assert(saldoManual === 5000, `manual sem conta não abate saldo (obteve ${saldoManual})`);
  const audit = auditLancamentosSemConta(cManual, contas);
  assert(audit.length === 1 && audit[0].motivo === 'manual_pago_sem_conta', 'audit aponta manual');

  console.log('\n— transferência PJ→PF: rendimento PF + card separado —');
  const cTransf = [lancTransferPf({ id: 'tr3', valor: 15000 })];
  const totTransf = calcTotaisResultadoPeriodo(cTransf, { ...PERIODO, perfil: 'pf' });
  assert(totTransf.receitas === 15000, 'repasse PJ→PF entra em receitas PF');
  assert(totTransf.transfRecebidas === 15000, 'repasse também no card separado');
  assert(isTransferenciaInterna(cTransf[0]), 'é transferência interna');
  assert(getSaldoConta('caixa1', contas, cTransf) === 15000, 'repasse entra no saldo da conta');

  console.log('\n— centavos: R$ 15.000 não vira R$ 14.999,99 —');
  const centavos = 1_500_000;
  const reais = reaisFromCentavos(centavos);
  assert(reais === 15000, `reaisFromCentavos ${reais}`);
  assert(safeNum(reais) === 15000, 'safeNum preserva 15000');

  console.log('\n— patchContaLancamentoPago em recorrência —');
  const patch = patchContaLancamentoPago(
    { id: 'x', tipo: 'Saida', valor: 2500, pago: true, status: 'pago', recorrenciaId: 'rec-x' },
    contas
  );
  assert(patch?.contaSaidaId === 'caixa1', 'patch preenche Caixa em recorrência');

  console.log('\n=== test:finance-account-balance: OK ===');
}

try {
  main();
} catch (e) {
  console.error('\n✗', e.message);
  process.exit(1);
}
