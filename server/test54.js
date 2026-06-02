/**
 * Teste integração PJ→PF — PF deve registrar Entrada/receita (não despesa).
 * Uso: node server/test54.js
 */
import { config } from 'dotenv';
config();

import bcrypt from 'bcryptjs';
import { query, pool } from './db.js';
import { createInitialState } from './initialState.js';
import { collectAllLancamentos } from './integracaoPfPj/estadoMerge.js';
import {
  isPlanoDespesaOuCusto,
  isPlanoReceita,
  pickPlanoDespesaPj,
  pickPlanoReceitaPf,
  snapshotPlanoCampos,
} from './integracaoPfPj/lancamentoPfPj.js';
import { addMoney, getDRE, getSaldoTotal } from '../src/gestor/finance.js';
import { parseValorToCentavos, reaisFromCentavos } from './utils/money.js';

const BASE = `http://127.0.0.1:${process.env.PORT || 3001}/api`;
const TS = Date.now();

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
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

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
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
  const { data } = await req('/auth/login', { method: 'POST', body: { email, senha } });
  return data.token;
}

async function seedPfComPlanoPj(usuarioId) {
  const { rows } = await query('SELECT dados FROM estados WHERE usuario_id = $1', [usuarioId]);
  const dados = rows[0].dados;
  const pjPlanos = createInitialState('juridica', 'PJ').empresas[0].planoContas;
  const emp = { ...dados.empresas[0], planoContas: pjPlanos };
  await query('UPDATE estados SET dados = $1 WHERE usuario_id = $2', [
    JSON.stringify({ ...dados, empresas: [emp] }),
    usuarioId,
  ]);
}

function metricasPf(dados) {
  const emp = dados.empresas[0];
  const lancs = collectAllLancamentos(dados);
  const contas = emp.contas || [];
  const planos = emp.planoContas || [];
  const ano = new Date().getFullYear().toString();
  const dre = getDRE(lancs, planos, ano, '');
  const saldo = getSaldoTotal(contas, lancs);
  const integracao = lancs.filter((l) => l.source === 'integracao_pf_pj');
  return { dre, saldo, integracao, lancs, planos, contas };
}

function metricasPj(dados) {
  const emp = dados.empresas[0];
  const lancs = emp.lancamentos || [];
  const planos = emp.planoContas || [];
  const ano = new Date().getFullYear().toString();
  const dre = getDRE(lancs, planos, ano, '');
  return { dre, lancs, planos };
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

function testSnapshotPlanoUnit() {
  const empPj = createInitialState('juridica', 'PJ').empresas[0];
  const plano = pickPlanoDespesaPj(empPj, 'pro_labore');
  const snap = snapshotPlanoCampos(plano, 'Saida');
  assert(snap.planoId && snap.planoDescricao && snap.planoCodigo, 'snapshotPlanoCampos PJ completo');
}

async function main() {
  console.log('=== Teste 54 — Integração PJ→PF (PF entrada + PJ discriminação) ===\n');

  testSnapshotPlanoUnit();

  const emailPj = `test_pj_54_${TS}@test.local`;
  const emailPf = `test_pf_54_${TS}@test.local`;
  const pass = 'test123456';

  await cleanup([emailPj, emailPf]);

  const pj = await createUser({ email: emailPj, senha: pass, tipo: 'juridica', nomePerfil: 'PJ Test 54' });
  const pf = await createUser({ email: emailPf, senha: pass, tipo: 'fisica', nomePerfil: 'PF Test 54' });

  await seedPfComPlanoPj(pf.id);

  const empPfPolluted = (await query('SELECT dados FROM estados WHERE usuario_id = $1', [pf.id])).rows[0]
    .dados.empresas[0];
  const planoTest = pickPlanoReceitaPf(empPfPolluted, 'pro_labore');
  assert(planoTest && isPlanoReceita(planoTest), 'pickPlanoReceitaPf ignora Custos Operacionais PJ');
  assert(!isPlanoDespesaOuCusto(planoTest), 'plano escolhido não é despesa/custo');

  const empPjSeed = (await query('SELECT dados FROM estados WHERE usuario_id = $1', [pj.id])).rows[0]
    .dados.empresas[0];
  const planoPjTest = pickPlanoDespesaPj(empPjSeed, 'pro_labore');
  assert(planoPjTest && isPlanoDespesaOuCusto(planoPjTest), 'pickPlanoDespesaPj escolhe despesa/custo');
  assert(!isPlanoReceita(planoPjTest), 'plano PJ não é receita');

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

  const ops = [
    ['/integracao-pf-pj/pro-labore', 5000, '2026-08-01'],
    ['/integracao-pf-pj/lucros', 500, '2026-08-02'],
    ['/integracao-pf-pj/salario', 3500, '2026-08-03'],
    ['/integracao-pf-pj/transferencia', 25000, '2026-08-04'],
  ];

  for (const [path, valor, data] of ops) {
    const valorCentavos = parseValorToCentavos(valor);
    await req(path, {
      method: 'POST',
      token: tokenPj,
      body: { valor, valorCentavos, data },
    });
  }

  const data15000 = '2026-08-05';
  const cents15000 = parseValorToCentavos(15000);
  assert(cents15000 === 1500000, `15000 → ${cents15000} centavos`);
  const conf15000 = await req('/integracao-pf-pj/transferencia', {
    method: 'POST',
    token: tokenPj,
    body: { valorCentavos: cents15000, data: data15000 },
  });
  const opId15000 = conf15000.data?.operacao?.id;
  assert(opId15000, 'confirmação transferência 15000 retorna operacao');

  const hist = await req('/integracao-pf-pj/operacoes', { token: tokenPj });
  const opHist = (hist.data?.operacoes || []).find((o) => o.id === opId15000);
  assert(opHist, 'operação 15000 no histórico');
  assert(opHist.valorCentavos === 1500000, `histórico valorCentavos=1500000 (got ${opHist.valorCentavos})`);
  assert(opHist.valor === 15000, `histórico valor=15000 (got ${opHist.valor})`);

  const row15000 = (
    await query(
      'SELECT valor_centavos FROM integracao_pf_pj_operacoes WHERE id = $1',
      [opId15000]
    )
  ).rows[0];
  assert(Number(row15000.valor_centavos) === 1500000, 'DB valor_centavos=1500000');

  const dadosPf15000 = (await query('SELECT dados FROM estados WHERE usuario_id = $1', [pf.id]))
    .rows[0].dados;
  const lPf15000 = collectAllLancamentos(dadosPf15000).find(
    (l) => l.id === conf15000.data?.lancamentoPfId
  );
  assert(lPf15000?.valor === 15000, `lançamento PF = 15000 (got ${lPf15000?.valor})`);
  assert(reaisFromCentavos(row15000.valor_centavos) === 15000, 'reaisFromCentavos DB');

  const dadosPf = (await query('SELECT dados FROM estados WHERE usuario_id = $1', [pf.id])).rows[0].dados;
  const dadosPj = (await query('SELECT dados FROM estados WHERE usuario_id = $1', [pj.id])).rows[0].dados;

  const mPf = metricasPf(dadosPf);
  const mPj = metricasPj(dadosPj);

  for (const l of mPf.integracao) {
    assert(l.tipo === 'Entrada', `PF integração tipo Entrada (${l.historico})`);
    assert(!l.contaSaidaId, `PF sem contaSaidaId (${l.historico})`);
    assert(!!l.contaEntradaId, `PF com contaEntradaId (${l.historico})`);
    if (l.planoId) {
      const plano = mPf.planos.find((p) => p.id === l.planoId);
      assert(plano && isPlanoReceita(plano), `PF plano receita (${plano?.descricao})`);
    }
    assert(l.historico?.includes('recebida') || l.historico?.includes('recebido'), `histórico PF (${l.historico})`);
  }

  assert(mPf.dre.receitas === 49000, `PF receitas = 49000 (got ${mPf.dre.receitas})`);
  assert(mPf.dre.despesas === 0, `PF despesas = 0 (got ${mPf.dre.despesas})`);
  assert(mPf.dre.custos === 0, `PF custos = 0 (got ${mPf.dre.custos})`);
  assert(mPf.saldo === 49000, `PF saldo = 49000 (got ${mPf.saldo})`);

  const lancsPjIntegracao = mPj.lancs.filter((l) => l.source === 'integracao_pf_pj');
  for (const l of lancsPjIntegracao) {
    assert(l.tipo === 'Saida', `PJ integração tipo Saida (${l.historico})`);
    assert(!l.contaEntradaId, `PJ sem contaEntradaId (${l.historico})`);
    assert(!!l.contaSaidaId, `PJ com contaSaidaId (${l.historico})`);
    assert(l.planoId || l.planoDescricao, `PJ com discriminação (${l.historico})`);
    if (l.planoId) {
      const plano = mPj.planos.find((p) => p.id === l.planoId);
      if (plano) assert(isPlanoDespesaOuCusto(plano), `PJ plano despesa/custo (${plano?.descricao})`);
    }
    const labelPj =
      l.planoDescricao || mPj.planos.find((p) => p.id === l.planoId)?.descricao;
    assert(labelPj, `PJ discriminação visível (${l.historico})`);
    if (!l.planoDescricao) {
      console.log(`  ⚠ PJ sem snapshot planoDescricao (redeploy API): ${l.historico}`);
    }
  }

  const saidasPj = lancsPjIntegracao.reduce(
    (s, l) => (l.tipo === 'Saida' ? addMoney(s, l.valor) : s),
    0
  );
  assert(saidasPj === 49000, `PJ saídas integração = 49000 (got ${saidasPj})`);
  assert(mPj.dre.receitas === 0, `PJ receitas inalteradas (got ${mPj.dre.receitas})`);

  await cleanup([emailPj, emailPf]);
  await pool.end();

  console.log('\n=== Teste 54: todos os testes passaram ===');
}

main().catch(async (err) => {
  console.error('\n✗', err.message);
  try { await pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
