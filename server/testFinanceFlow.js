/**
 * Testes Etapa 7.8C — Fluxo previsto, datas pagamento/vencimento, integração centavos
 * npm run test:finance-flow
 */
import { config } from 'dotenv';
config();

import bcrypt from 'bcryptjs';
import { query, pool } from './db.js';
import { createInitialState } from './initialState.js';
import { collectAllLancamentos } from './integracaoPfPj/estadoMerge.js';
import { auditOperacaoConsistencia } from './integracaoPfPj/operacaoWriter.js';
import { parseValorToCentavos, reaisFromCentavos } from './utils/money.js';
import {
  isLancamentoPago,
  getDataPagamento,
  getDataPrevista,
  getDataRealizacao,
  filterLancamentosPrevistos,
  filterLancamentosRealizados,
} from './financeStatus.js';
import {
  calcFluxoPrevisto30d,
  parseMoneyInputToCentavos,
  reaisFromCentavos as reaisFromCentavosClient,
} from '../src/gestor/finance.js';

const BASE = `http://127.0.0.1:${process.env.PORT || 3001}/api`;
const TS = Date.now();
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
  return { status: res.status, data, ok: res.ok };
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
  const { data, ok } = await req('/auth/login', { body: { email, senha } });
  if (!ok) throw new Error(`login ${email} falhou`);
  return data.token;
}

async function cleanup(emails) {
  for (const email of emails) {
    const { rows } = await query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (rows.length) {
      await query(
        'DELETE FROM integracao_pf_pj_vinculo WHERE usuario_pj_id = $1 OR usuario_pf_id = $1',
        [rows[0].id]
      );
      await query('DELETE FROM usuarios WHERE id = $1', [rows[0].id]);
    }
  }
}

function runUnitTests() {
  console.log('— financeStatus / datas —');
  assert(isLancamentoPago({ status: 'pago' }), 'status pago');
  assert(!isLancamentoPago({ status: 'pendente' }), 'pendente não é pago');
  assert(getDataPrevista({ vencimento: '2026-06-10', data: '2026-06-01' }) === '2026-06-10', 'previsto = vencimento');
  assert(getDataPagamento({ dataPagamento: '2026-06-05' }) === '2026-06-05', 'dataPagamento');
  assert(
    getDataRealizacao({ pago: true, dataPagamento: '2026-06-05', vencimento: '2026-06-10' }) === '2026-06-05',
    'realizado = dataPagamento'
  );
  assert(getDataRealizacao({ status: 'pendente', vencimento: '2026-06-10' }) === null, 'pendente sem realizado');

  console.log('\n— centavos —');
  const cents15000 = parseMoneyInputToCentavos('15000');
  assert(cents15000 === 1500000, `15000 → ${cents15000} centavos`);
  assert(reaisFromCentavos(1500000) === 15000, '1500000 centavos → 15000 reais');
  assert(reaisFromCentavosClient(1500000) === 15000, 'client reaisFromCentavos');
  const bad = reaisFromCentavos(1499999);
  assert(bad === 14999.99, 'float legado 1499999 → 14999.99 (não deve ser gerado na integração)');

  console.log('\n— fluxo previsto 30d —');
  const hoje = '2026-06-04';
  const ate = '2026-07-04';
  const lancs = [
    {
      id: '1',
      tipo: 'Saida',
      valor: 500,
      vencimento: '2026-06-10',
      data: '2026-06-10',
      status: 'pago',
      pago: true,
      dataPagamento: '2026-06-05',
    },
    {
      id: '2',
      tipo: 'Saida',
      valor: 300,
      vencimento: '2026-06-10',
      data: '2026-06-10',
      status: 'pendente',
      pago: false,
    },
  ];

  const previstos = filterLancamentosPrevistos(lancs, { hoje, ate });
  assert(previstos.length === 1 && previstos[0].id === '2', 'pago dia 05 não entra no previsto');
  assert(calcFluxoPrevisto30d(lancs, hoje) === -300, 'fluxo previsto só pendente');

  const realizados = filterLancamentosRealizados(lancs, { ano: ANO, mes: MES });
  assert(realizados.length === 1 && realizados[0].id === '1', 'pago entra no realizado');
  assert(getDataRealizacao(realizados[0]) === '2026-06-05', 'realizado na data pagamento');

  console.log('\n— desfazer pagamento —');
  const desfeito = lancs.map((l) =>
    l.id === '1'
      ? { ...l, status: 'pendente', pago: false, dataPagamento: null, pagoEm: null }
      : l
  );
  assert(filterLancamentosPrevistos(desfeito, { hoje, ate }).length === 2, 'desfeito volta ao previsto');
  assert(filterLancamentosRealizados(desfeito, { ano: ANO, mes: MES }).length === 0, 'desfeito sai do realizado');
}

async function runIntegrationTests() {
  const health = await fetch(`${BASE}/auth/login`, { method: 'POST' }).catch(() => null);
  if (!health) {
    console.log('\n— integração API: servidor indisponível, pulando —');
    return;
  }

  console.log('\n— integração PJ→PF R$ 15.000 —');
  const emailPj = `test_flow_pj_${TS}@test.local`;
  const emailPf = `test_flow_pf_${TS}@test.local`;
  const pass = 'test123456';
  await cleanup([emailPj, emailPf]);

  const pj = await createUser({ email: emailPj, senha: pass, tipo: 'juridica', nomePerfil: 'PJ Flow' });
  const pf = await createUser({ email: emailPf, senha: pass, tipo: 'fisica', nomePerfil: 'PF Flow' });
  const tokenPj = await login(emailPj, pass);
  const tokenPf = await login(emailPf, pass);

  const vinc = await req('/integracao-pf-pj/vinculo', {
    method: 'POST',
    token: tokenPj,
    body: { email: emailPf },
  });
  await req('/integracao-pf-pj/aceitar', {
    method: 'POST',
    token: tokenPf,
    body: { vinculoId: vinc.data.vinculo.id },
  });

  const valorCentavos = parseValorToCentavos(15000);
  assert(valorCentavos === 1500000, 'API cents 1500000');

  const conf = await req('/integracao-pf-pj/transferencia', {
    method: 'POST',
    token: tokenPj,
    body: { valorCentavos, data: '2026-06-05', observacao: 'teste 7.8C' },
  });
  assert(conf.ok, 'transferência confirmada');
  assert(conf.data.operacao.valorCentavos === 1500000, 'operacao valor_centavos');

  const { rows: rowsPj } = await query('SELECT dados FROM estados WHERE usuario_id = $1', [pj.id]);
  const { rows: rowsPf } = await query('SELECT dados FROM estados WHERE usuario_id = $1', [pf.id]);
  const lPj = collectAllLancamentos(rowsPj[0].dados).find((l) => l.id === conf.data.lancamentoPjId);
  const lPf = collectAllLancamentos(rowsPf[0].dados).find((l) => l.id === conf.data.lancamentoPfId);
  assert(lPj?.valor === 15000, `PJ saída ${lPj?.valor}`);
  assert(lPf?.valor === 15000, `PF entrada ${lPf?.valor}`);
  assert(lPj?.valor !== 14999.99, 'PJ nunca 14999.99');
  assert(lPf?.valor !== 14999.99, 'PF nunca 14999.99');

  const list = await req('/integracao-pf-pj/operacoes', { token: tokenPj });
  const opHist = list.data.operacoes?.[0];
  assert(opHist?.valor === 15000, 'histórico valor 15000');
  assert(!opHist?.divergente, 'operação consistente');

  console.log('\n— rollback bilateral —');
  const rb = await req(`/integracao-pf-pj/operacoes/${conf.data.operacao.id}/rollback`, {
    method: 'POST',
    token: tokenPj,
  });
  assert(rb.ok && rb.data.removidosPj === 1 && rb.data.removidosPf === 1, 'rollback remove os dois lados');

  console.log('\n— rollback inconsistente (PF ausente) —');
  const conf2 = await req('/integracao-pf-pj/transferencia', {
    method: 'POST',
    token: tokenPj,
    body: { valorCentavos: parseValorToCentavos(2000), data: '2026-06-06' },
  });
  const opId2 = conf2.data.operacao.id;
  const pfId2 = conf2.data.lancamentoPfId;

  const { rows: rowsPf2 } = await query('SELECT dados FROM estados WHERE usuario_id = $1', [pf.id]);
  const dadosPf = rowsPf2[0].dados;
  const empresas = dadosPf.empresas.map((emp) => ({
    ...emp,
    lancamentos: (emp.lancamentos || []).filter((l) => String(l.id) !== String(pfId2)),
  }));
  await query('UPDATE estados SET dados = $1 WHERE usuario_id = $2', [
    JSON.stringify({ ...dadosPf, empresas }),
    pf.id,
  ]);

  const rbBad = await req(`/integracao-pf-pj/operacoes/${opId2}/rollback`, {
    method: 'POST',
    token: tokenPj,
  });
  assert(
    rbBad.status === 409,
    `rollback inconsistente retorna 409 (got ${rbBad.status} ${JSON.stringify(rbBad.data)})`
  );
  assert(
    String(rbBad.data.error || '').includes('Reparar vínculo'),
    'mensagem amigável rollback'
  );

  const audit = auditOperacaoConsistencia(
    { ...conf2.data.operacao, lancamentoPjId: conf2.data.lancamentoPjId, lancamentoPfId: pfId2 },
    (await query('SELECT dados FROM estados WHERE usuario_id = $1', [pj.id])).rows[0]?.dados,
    (await query('SELECT dados FROM estados WHERE usuario_id = $1', [pf.id])).rows[0]?.dados
  );
  assert(audit.divergente && !audit.lancPfPresente, 'audit detecta PF ausente');

  await cleanup([emailPj, emailPf]);
}

async function main() {
  console.log('=== Testes Etapa 7.8C — Finance flow ===\n');
  runUnitTests();
  await runIntegrationTests();
  await pool.end();
  console.log('\n=== test:finance-flow — todos os testes passaram ===');
}

main().catch(async (err) => {
  console.error('\n✗', err.message);
  try { await pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
