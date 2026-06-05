/**
 * Testes emergenciais — bugfix consistência financeira pós-7.8C
 * npm run test:finance-bugfix
 */
import {
  calcFluxoPrevisto30d,
  calcTotaisResultadoPeriodo,
  calcSaldoCaixaPeriodo,
  sumPagasNoMes,
  getSaldoConta,
  isTransferenciaInterna,
  lancamentoAfetaSaldoCaixa,
  dedupeLancamentosById,
} from '../src/gestor/finance.js';

const ANO = '2026';
const MES = '06';
const PERIODO = { ano: ANO, mes: MES };

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

function lancRecPaga({ id, valor, historico, dataPagamento = `${ANO}-${MES}-10` }) {
  return {
    id,
    tipo: 'Saida',
    valor,
    historico,
    data: `${ANO}-${MES}-10`,
    vencimento: `${ANO}-${MES}-10`,
    status: 'pago',
    pago: true,
    dataPagamento,
    recorrenciaId: `rec-${id}`,
    source: 'recorrencia',
    contaSaidaId: 'banco1',
  };
}

function lancTransferPf({ id, valor, data = `${ANO}-${MES}-05` }) {
  return {
    id,
    tipo: 'Entrada',
    valor,
    historico: 'Transferência recebida — Empresa PJ',
    data,
    status: 'pago',
    pago: true,
    dataPagamento: data,
    source: 'integracao_pf_pj',
    tipoOperacao: 'transferencia_pj_pf',
    integracaoPfPj: { tipoOperacao: 'transferencia_pj_pf', lado: 'pf' },
    contaEntradaId: 'banco1',
  };
}

function lancReceitaReal({ id, valor, data = `${ANO}-${MES}-12` }) {
  return {
    id,
    tipo: 'Entrada',
    valor,
    historico: 'Freelance',
    data,
    status: 'pago',
    pago: true,
    dataPagamento: data,
    contaEntradaId: 'banco1',
  };
}

function main() {
  console.log('=== test:finance-bugfix ===\n');

  console.log('— isTransferenciaInterna —');
  assert(isTransferenciaInterna(lancTransferPf({ id: 't1', valor: 15000 })), 'integracao transferencia_pj_pf');
  assert(!isTransferenciaInterna(lancReceitaReal({ id: 'r1', valor: 5000 })), 'receita real não é repasse');
  assert(!isTransferenciaInterna(lancRecPaga({ id: 'd1', valor: 2500, historico: 'Financiamento' })), 'despesa recorrente não é repasse');

  console.log('\n— cenário 1: duas recorrências pagas R$ 2.500 —');
  const c1 = [
    lancRecPaga({ id: 'fin', valor: 2500, historico: 'Financiamento' }),
    lancRecPaga({ id: 'ped', valor: 2500, historico: 'Pedreiro' }),
    lancTransferPf({ id: 'tr', valor: 15000 }),
    lancReceitaReal({ id: 'rec-op', valor: 5000 }),
    // duplicata acidental (mesmo id não deve somar 2x)
    { ...lancRecPaga({ id: 'fin', valor: 2500, historico: 'Financiamento dup' }) },
  ];
  const pagas = sumPagasNoMes(c1, PERIODO);
  assert(pagas === 5000, `pagasNoMes = R$ 5.000 (obteve ${pagas})`);

  console.log('\n— cenário 2: Dashboard PF — rendimentos incluem repasse —');
  const totais = calcTotaisResultadoPeriodo(c1, { ...PERIODO, perfil: 'pf' });
  assert(totais.receitas === 20000, `receitas PF R$ 20.000 (obteve ${totais.receitas})`);
  assert(totais.transfRecebidas === 15000, `transferências recebidas R$ 15.000 (obteve ${totais.transfRecebidas})`);
  assert(totais.despesas === 5000, `despesas PF R$ 5.000 (obteve ${totais.despesas})`);
  assert(totais.saldo === 15000, `saldo período PF R$ 15.000 (obteve ${totais.saldo})`);

  console.log('\n— cenário 2b: PJ — repasse não é receita —');
  const lancPjSaida = {
    id: 'pj-out',
    tipo: 'Saida',
    valor: 15000,
    historico: 'Transferência PJ→PF — Sócio',
    data: `${ANO}-${MES}-05`,
    status: 'pago',
    pago: true,
    dataPagamento: `${ANO}-${MES}-05`,
    source: 'integracao_pf_pj',
    tipoOperacao: 'transferencia_pj_pf',
    integracaoPfPj: { tipoOperacao: 'transferencia_pj_pf', lado: 'pj' },
    contaSaidaId: 'banco-pj',
  };
  const totaisPj = calcTotaisResultadoPeriodo([lancPjSaida], { ...PERIODO, perfil: 'pj' });
  assert(totaisPj.receitas === 0, `PJ receitas zero (obteve ${totaisPj.receitas})`);
  assert(totaisPj.despesas === 15000, `PJ despesa repasse R$ 15.000 (obteve ${totaisPj.despesas})`);

  console.log('\n— cenário 3: saldo de caixa inclui transferência —');
  const contas = [{ id: 'banco1', nome: 'Banco', tipo: 'Banco', saldoInicial: 0, inativo: false }];
  const saldo = getSaldoConta('banco1', contas, c1);
  assert(saldo === 15000, `saldo caixa quitados + repasses (obteve ${saldo})`);

  console.log('\n— cenário 3b: recorrência paga sem contaSaidaId usa inferência —');
  const pedreiroRecSemConta = {
    id: 'ped2',
    tipo: 'Saida',
    valor: 2500,
    historico: 'Pedreiro',
    data: `${ANO}-${MES}-10`,
    vencimento: `${ANO}-${MES}-10`,
    status: 'pago',
    pago: true,
    dataPagamento: `${ANO}-${MES}-08`,
    recorrenciaId: 'rec-ped2',
    source: 'recorrencia',
  };
  const cPed = [
    lancTransferPf({ id: 'tr2', valor: 20000 }),
    lancRecPaga({ id: 'fin2', valor: 2500, historico: 'Financiamento' }),
    pedreiroRecSemConta,
  ];
  const saldoPed = getSaldoConta('banco1', contas, cPed);
  assert(saldoPed === 15000, `recorrência quitada desconta via conta padrão (obteve ${saldoPed})`);

  console.log('\n— cenário 3b1: quitado via botão sem conta gravada ainda desconta caixa —');
  const pedreiroQuitadoBotao = {
    id: 'ped-botao',
    tipo: 'Saida',
    valor: 2500,
    historico: 'Pedreiro',
    data: `${ANO}-${MES}-10`,
    vencimento: `${ANO}-${MES}-10`,
    status: 'pago',
    pago: true,
    dataPagamento: `${ANO}-${MES}-04`,
  };
  const saldoBotao = getSaldoConta('banco1', contas, [
    lancTransferPf({ id: 'tr-bot', valor: 5000 }),
    lancRecPaga({ id: 'fin-bot', valor: 2500, historico: 'Financiamento' }),
    pedreiroQuitadoBotao,
  ]);
  assert(saldoBotao === 0, `quitado sem conta gravada abate caixa (obteve ${saldoBotao})`);

  console.log('\n— cenário 3b2: manual pago sem conta não desconta —');
  const manualSemConta = {
    id: 'man-ped',
    tipo: 'Saida',
    valor: 2500,
    historico: 'Pedreiro manual',
    data: `${ANO}-${MES}-10`,
    status: 'pago',
    pago: true,
    dataPagamento: `${ANO}-${MES}-08`,
    excluirContaCaixa: true,
  };
  const saldoManual = getSaldoConta('banco1', contas, [
    lancTransferPf({ id: 'tr2b', valor: 20000 }),
    lancRecPaga({ id: 'fin2b', valor: 2500, historico: 'Financiamento' }),
    manualSemConta,
  ]);
  assert(saldoManual === 17500, `manual sem conta não abate saldo (obteve ${saldoManual})`);

  console.log('\n— cenário 3c: pendente não reduz caixa —');
  const pendente = {
    id: 'pend-caixa',
    tipo: 'Saida',
    valor: 2500,
    historico: 'Pedreiro pendente',
    data: `${ANO}-${MES}-10`,
    vencimento: `${ANO}-${MES}-10`,
    status: 'pendente',
    pago: false,
    contaSaidaId: 'banco1',
  };
  const saldoPend = getSaldoConta('banco1', contas, [lancTransferPf({ id: 'tr3', valor: 17500 }), pendente]);
  assert(saldoPend === 17500, `pendente não reduz caixa (obteve ${saldoPend})`);
  assert(!lancamentoAfetaSaldoCaixa(pendente), 'pendente não afeta saldo');

  const caixaPeriodo = calcSaldoCaixaPeriodo(cPed, PERIODO);
  assert(caixaPeriodo === 15000, `saldo caixa período junho ${caixaPeriodo}`);

  console.log('\n— cenário 4: fluxo previsto sem pagas —');
  const c4 = [
    ...c1,
    {
      id: 'pend',
      tipo: 'Saida',
      valor: 800,
      vencimento: '2026-06-20',
      data: '2026-06-20',
      status: 'pendente',
      pago: false,
    },
  ];
  const previsto = calcFluxoPrevisto30d(
    c4.filter((l) => l.id === 'pend'),
    '2026-06-04'
  );
  assert(previsto === -800, 'só pendente entra no fluxo previsto');
  const previstoPagas = calcFluxoPrevisto30d(c1, '2026-06-04');
  assert(previstoPagas === 0, 'contas pagas não aparecem no fluxo previsto');

  console.log('\n— dedupe por id —');
  assert(dedupeLancamentosById(c1).length === 4, '4 lançamentos únicos após dedupe');

  console.log('\n=== test:finance-bugfix: OK ===');
}

try {
  main();
} catch (e) {
  console.error('\n✗', e.message);
  process.exit(1);
}
