/**
 * Testes Etapa 7.8B — Consistência financeira geral
 * npm run test:finance-consistency
 */
import { config } from 'dotenv';
config();

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { query, pool } from './db.js';
import { createInitialState } from './initialState.js';
import { collectAllLancamentos } from './integracaoPfPj/estadoMerge.js';
import { parseValorToCentavos, reaisToCentavos } from './utils/money.js';
import {
  isLancamentoPago,
  getDataRealizacao,
  getValorRealizado,
  filterLancamentosRealizados,
  normalizeLancamentoStatus,
} from './financeStatus.js';
import {
  addMoney,
  getDRE,
  getSaldoConta,
  subMoney,
} from '../src/gestor/finance.js';
import { accumulateResultadoPorCampo, finalizeResultadoRows } from '../src/gestor/resultadoFinanceiro.js';
import { buildResumoAnual } from '../src/gestor/resumoAnual.js';

const BASE = `http://127.0.0.1:${process.env.PORT || 3001}/api`;
const TS = Date.now();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ANO = '2026';
const MES = '06';

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || (opts.body !== undefined ? 'POST' : 'GET'),
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !opts.allowError) {
    throw new Error(`${path} → ${res.status}: ${data.error || res.statusText}`);
  }
  return { status: res.status, data };
}

async function createUser({ email, senha, tipo, nomePerfil }) {
  const hash = await bcrypt.hash(senha, 12);
  const ins = await query(
    `INSERT INTO usuarios (email, senha_hash, nome, role, ativo, tipo_perfil, nome_perfil, email_verificado)
     VALUES ($1,$2,$3,'user',true,$4,$5,true) RETURNING id`,
    [email, hash, nomePerfil, tipo, nomePerfil]
  );
  const st = createInitialState(tipo, nomePerfil);
  await query('INSERT INTO estados (usuario_id, dados) VALUES ($1,$2)', [
    ins.rows[0].id,
    JSON.stringify(st),
  ]);
  return ins.rows[0];
}

async function login(email, senha) {
  const { data } = await req('/auth/login', { body: { email, senha } });
  return data.token;
}

function lancPago({ id, valor, planoId, tipo = 'Saida', data = `${ANO}-${MES}-10` }) {
  return {
    id,
    tipo,
    valor,
    planoId,
    data,
    vencimento: data,
    status: 'pago',
    pago: true,
    dataPagamento: data,
  };
}

function lancPendente({ id, valor, planoId, data = `${ANO}-${MES}-15` }) {
  return {
    id,
    tipo: 'Saida',
    valor,
    planoId,
    data,
    vencimento: data,
    status: 'pendente',
    pago: false,
  };
}

function sumRealizadoDespesas(lancamentos, planoId) {
  return filterLancamentosRealizados(lancamentos, { ano: ANO, mes: MES, tipo: 'Saida' })
    .filter((l) => l.planoId === planoId)
    .reduce((s, l) => addMoney(s, l.valor), 0);
}

async function main() {
  console.log('=== Testes Etapa 7.8B — Consistência financeira ===\n');

  console.log('— arquivos —');
  const files = [
    'src/gestor/financeStatus.js',
    'server/financeStatus.js',
    'server/auditIntegracaoPfPjConsistencia.js',
    'server/repairIntegracaoPfPjConsistencia.js',
    'src/gestor/components/dashboard/MovimentacoesMesWidget.jsx',
  ];
  for (const f of files) assert(existsSync(join(ROOT, f)), `${f} existe`);

  const pkg = readFileSync(join(ROOT, 'package.json'), 'utf8');
  assert(pkg.includes('"test:finance-consistency"'), 'script test:finance-consistency');

  console.log('\n— financeStatus —');
  assert(isLancamentoPago({ status: 'pago' }), 'status pago');
  assert(isLancamentoPago({ status: 'quitada' }), 'status quitada');
  assert(!isLancamentoPago({ status: 'pendente' }), 'pendente não é pago');
  assert(isLancamentoPago({ pago: true }), 'pago boolean');
  assert(
    getDataRealizacao({ pago: true, dataPagamento: '2026-06-05', data: '2026-06-01' }) === '2026-06-05',
    'dataPagamento prioridade'
  );
  assert(getDataRealizacao({ status: 'pendente', data: '2026-06-01' }) === null, 'pendente sem realização');
  assert(getValorRealizado({ pago: true, valor: 2500 }) === 2500, 'valor realizado');
  assert(getValorRealizado({ status: 'pendente', valor: 2500 }) === 0, 'pendente valor 0');
  assert(normalizeLancamentoStatus({ pago: false, status: 'pendente' }) === 'pendente', 'normalize pendente');

  console.log('\n— orçamento realizado (pagas) —');
  const planoId = 'cat-test';
  const lancs = [
    lancPago({ id: '1', valor: 2500, planoId }),
    lancPago({ id: '2', valor: 2500, planoId }),
    lancPago({ id: '3', valor: 50, planoId }),
    lancPendente({ id: '4', valor: 9999, planoId }),
  ];
  const realizado = sumRealizadoDespesas(lancs, planoId);
  assert(realizado === 5050, `realizado R$ 5.050 (obteve ${realizado})`);

  console.log('\n— DRE modo caixa —');
  const planos = [
    { id: planoId, tipo: 'Despesa', descricao: 'Teste', codigo: 1, inativo: false },
    { id: 'rec', tipo: 'Receita', descricao: 'Rec', codigo: 2, inativo: false },
  ];
  const dre = getDRE(lancs, planos, ANO, MES);
  assert(dre.despesas === 5050, `DRE despesas pagas ${dre.despesas}`);
  assert(dre.despesas !== 15049, 'pendente não entra no DRE');

  console.log('\n— resultado / resumo anual —');
  const buckets = accumulateResultadoPorCampo(lancs, planos, 'centroCustoId', { ano: ANO, mes: MES, isPF: true });
  const { totais } = finalizeResultadoRows(buckets, {
    idField: 'centroCustoId',
    nomeResolver: () => '—',
    semLabel: 'Sem centro',
  });
  assert(totais.despesas === 5050, 'resultado por centro despesas pagas');

  const resumo = buildResumoAnual({
    lancamentos: lancs,
    planoContas: planos,
    contas: [],
    ano: ANO,
    isPF: true,
  });
  const mesIdx = 5;
  const vbspJun = resumo.vbsp?.totais?.[mesIdx] ?? 0;
  const dreJun = resumo.fechamento?.despesaMeses?.[mesIdx] ?? resumo.mensalDre?.[mesIdx]?.despesas;
  assert(vbspJun === 5050 || dreJun === 5050, `resumo anual junho: vbsp=${vbspJun} dre=${dreJun}`);

  console.log('\n— desfazer pagamento —');
  const desfeito = lancs.map((l) =>
    l.id === '1' ? { ...l, status: 'pendente', pago: false, dataPagamento: null } : l
  );
  assert(sumRealizadoDespesas(desfeito, planoId) === 2550, 'desfazer remove do realizado');

  console.log('\n— saldo negativo (não bloqueia) —');
  const contas = [{ id: 'banco1', nome: 'Banco', tipo: 'Banco', saldoInicial: 0, inativo: false }];
  const saida = {
    id: 's1',
    tipo: 'Saida',
    valor: 100,
    contaSaidaId: 'banco1',
    data: `${ANO}-${MES}-01`,
    pago: true,
    status: 'pago',
    planoId,
  };
  const saldo = getSaldoConta('banco1', contas, [saida]);
  assert(saldo === -100, `saldo negativo ${saldo}`);

  console.log('\n— recorrência paga —');
  const recLanc = {
    id: 'rec-l1',
    tipo: 'Saida',
    valor: 2500,
    planoId,
    data: `${ANO}-${MES}-08`,
    vencimento: `${ANO}-${MES}-08`,
    status: 'pago',
    pago: true,
    dataPagamento: `${ANO}-${MES}-08`,
    source: 'recorrencia',
    recorrenciaId: 'rec-1',
    recorrenciaMes: `${ANO}-${MES}`,
  };
  const dashDesp = filterLancamentosRealizados([recLanc], { ano: ANO, mes: MES, tipo: 'Saida' })
    .reduce((s, l) => addMoney(s, l.valor), 0);
  assert(dashDesp === 2500, 'recorrência paga no dashboard');

  console.log('\n— integração PJ→PF R$ 15.000 —');
  const emailPj = `fin78b_pj_${TS}@fluxiva.test`;
  const emailPf = `fin78b_pf_${TS}@fluxiva.test`;
  const pass = 'Test78b!abc';

  for (const em of [emailPj, emailPf]) {
    const { rows } = await query('SELECT id FROM usuarios WHERE email = $1', [em]);
    if (rows.length) {
      await query('DELETE FROM integracao_pf_pj_vinculo WHERE usuario_pj_id = $1 OR usuario_pf_id = $1', [rows[0].id]);
      await query('DELETE FROM usuarios WHERE id = $1', [rows[0].id]);
    }
  }

  const pj = await createUser({ email: emailPj, senha: pass, tipo: 'juridica', nomePerfil: 'PJ 78B' });
  const pf = await createUser({ email: emailPf, senha: pass, tipo: 'fisica', nomePerfil: 'PF 78B' });

  const pfState = createInitialState('juridica', 'PF 78B').empresas[0].planoContas;
  const { rows: pfEst } = await query('SELECT dados FROM estados WHERE usuario_id = $1', [pf.id]);
  const dadosPf0 = pfEst[0].dados;
  dadosPf0.empresas[0].planoContas = pfState;
  await query('UPDATE estados SET dados = $1 WHERE usuario_id = $2', [JSON.stringify(dadosPf0), pf.id]);

  const tokenPj = await login(emailPj, pass);
  const tokenPf = await login(emailPf, pass);

  const criado = await req('/integracao-pf-pj/vinculo', {
    method: 'POST',
    token: tokenPj,
    body: { email: emailPf },
  });
  await req('/integracao-pf-pj/aceitar', {
    method: 'POST',
    token: tokenPf,
    body: { vinculoId: criado.data.vinculo.id },
  });

  const valor = 15000;
  const cents = parseValorToCentavos(valor);
  await req('/integracao-pf-pj/transferencia', {
    method: 'POST',
    token: tokenPj,
    body: { valorCentavos: cents, data: `${ANO}-${MES}-12`, observacao: 'teste 78B' },
  });

  const { rows: estPjAfter } = await query('SELECT dados FROM estados WHERE usuario_id = $1', [pj.id]);
  const { rows: estPfAfter } = await query('SELECT dados FROM estados WHERE usuario_id = $1', [pf.id]);
  const lPj = collectAllLancamentos(estPjAfter[0].dados).filter((l) => l.source === 'integracao_pf_pj').pop();
  const lPf = collectAllLancamentos(estPfAfter[0].dados).filter((l) => l.source === 'integracao_pf_pj').pop();
  assert(lPj && lPf, 'lançamentos PJ e PF existem');
  assert(reaisToCentavos(lPj.valor) === cents, `PJ saída ${lPj.valor}`);
  assert(reaisToCentavos(lPf.valor) === cents, `PF entrada ${lPf.valor}`);
  assert(lPj.integracaoPfPj?.operacaoId === lPf.integracaoPfPj?.operacaoId, 'mesmo operacao_id');

  const { rows: ops } = await query(
    `SELECT id FROM integracao_pf_pj_operacoes WHERE lancamento_pj_id = $1`,
    [lPj.id]
  );
  const opId = ops[0]?.id;
  await req(`/integracao-pf-pj/operacoes/${opId}/rollback`, { method: 'POST', token: tokenPj });

  const { rows: estPjRb } = await query('SELECT dados FROM estados WHERE usuario_id = $1', [pj.id]);
  const { rows: estPfRb } = await query('SELECT dados FROM estados WHERE usuario_id = $1', [pf.id]);
  const remPj = collectAllLancamentos(estPjRb[0].dados).filter((l) => l.id === lPj.id);
  const remPf = collectAllLancamentos(estPfRb[0].dados).filter((l) => l.id === lPf.id);
  assert(remPj.length === 0 && remPf.length === 0, 'rollback remove ambos lançamentos');

  console.log('\n— preserveIntegracao no PUT (arquivo) —');
  const mergeTxt = readFileSync(join(ROOT, 'server/integracaoPfPj/estadoMerge.js'), 'utf8');
  assert(mergeTxt.includes('preserveIntegracaoLancamentosFromServer'), 'merge protege integração');

  console.log('\n=== Todos os testes 7.8B passaram ===\n');
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
