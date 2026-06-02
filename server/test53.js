/**
 * Teste urgente — preservação de estado PF/PJ na integração PF/PJ
 * Uso: node server/test53.js  (API em PORT=3001)
 */
import { config } from 'dotenv';
config();

import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { query, pool } from './db.js';
import { createInitialState } from './initialState.js';
import { collectAllLancamentos } from './integracaoPfPj/estadoMerge.js';

const BASE = `http://127.0.0.1:${process.env.PORT || 3001}/api`;
const TS = Date.now();
const SOURCE = 'integracao_pf_pj';

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
     VALUES ($1,$2,$3,'user',true,$4,$5,true) RETURNING id, email`,
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

async function getEstado(usuarioId) {
  const { rows } = await query('SELECT dados FROM estados WHERE usuario_id = $1', [usuarioId]);
  return rows[0]?.dados;
}

function allLancamentos(dados) {
  return collectAllLancamentos(dados);
}

function snapshotPf(dados) {
  const lancs = allLancamentos(dados);
  const metas = dados?.empresas?.flatMap((e) => e.metas || []) || [];
  const orcamentos = dados?.empresas?.flatMap((e) => e.orcamentos || []) || [];
  const contas = dados?.empresas?.flatMap((e) => e.contas || []) || [];
  return {
    lancIds: new Set(lancs.map((l) => l.id)),
    metaNomes: new Set(metas.map((m) => m.nome)),
    orcCategorias: new Set(orcamentos.map((o) => o.categoria)),
    contasNomes: new Set(contas.map((c) => c.nome)),
    empresaCount: dados?.empresas?.length ?? 0,
    abertos: lancs.filter((l) => !l.pago).length,
  };
}

function assertPfPreserved(after, before, ids, label) {
  for (const id of ids) {
    assert(after.lancIds.has(id), `${label}: lançamento ${id} preservado`);
  }
  for (const nome of before.metaNomes) {
    assert(after.metaNomes.has(nome), `${label}: meta "${nome}" preservada`);
  }
  for (const cat of before.orcCategorias) {
    assert(after.orcCategorias.has(cat), `${label}: orçamento "${cat}" preservado`);
  }
  for (const nome of before.contasNomes) {
    assert(after.contasNomes.has(nome), `${label}: conta "${nome}" preservada`);
  }
  assert(after.abertos >= before.abertos, `${label}: contas a pagar/receber (abertos) preservadas`);
}

async function seedLegacyMultiEmpresaPf(usuarioId) {
  const dados = await getEstado(usuarioId);
  const emp1 = { ...dados.empresas[0] };
  const emp2Id = randomUUID();
  const lancLegado = {
    id: randomUUID(),
    codigo: 100,
    data: '2019-05-01',
    tipo: 'Entrada',
    valor: 5000,
    historico: 'Salário antigo legado (empresa secundária)',
    source: 'manual',
    pago: true,
  };
  const emp2 = {
    ...emp1,
    id: emp2Id,
    nome: 'Perfil legado PF',
    tipo: 'fisica',
    lancamentos: [lancLegado],
    metas: [{ id: randomUUID(), nome: 'Meta legado', valor: 1000, ativa: true }],
    orcamentos: [{ id: randomUUID(), categoria: 'Legado', valor: 200, mes: '01' }],
  };
  const novosDados = {
    ...dados,
    empresas: [{ ...emp1, lancamentos: emp1.lancamentos || [] }, emp2],
    empresaAtivaId: emp1.id,
  };
  await query('UPDATE estados SET dados = $1 WHERE usuario_id = $2', [
    JSON.stringify(novosDados),
    usuarioId,
  ]);
  return { lancLegadoId: lancLegado.id, emp2Id };
}

async function seedPfRichData(usuarioId) {
  const dados = await getEstado(usuarioId);
  const emp = { ...dados.empresas[0] };
  const manualId = randomUUID();
  const apId = randomUUID();
  const arId = randomUUID();
  const manual = {
    id: manualId,
    codigo: 1,
    data: '2020-01-01',
    tipo: 'Entrada',
    valor: 1000,
    historico: 'Lançamento manual PF antigo',
    source: 'manual',
    pago: true,
  };
  const aPagar = {
    id: apId,
    codigo: 2,
    data: '2026-07-01',
    tipo: 'Saida',
    valor: 150,
    historico: 'Conta a pagar antiga',
    source: 'manual',
    pago: false,
  };
  const aReceber = {
    id: arId,
    codigo: 3,
    data: '2026-07-10',
    tipo: 'Entrada',
    valor: 250,
    historico: 'Conta a receber antiga',
    source: 'manual',
    pago: false,
  };
  emp.lancamentos = [...(emp.lancamentos || []), manual, aPagar, aReceber];
  emp.metas = [
    ...(emp.metas || []),
    { id: randomUUID(), nome: 'Reserva emergência', valor: 10000, ativa: true },
  ];
  emp.orcamentos = [
    ...(emp.orcamentos || []),
    { id: randomUUID(), categoria: 'Moradia', valor: 2000, mes: '06' },
  ];
  emp.contas = [
    ...(emp.contas || []),
    {
      id: randomUUID(),
      codigo: 99,
      nome: 'Conta Extra Auditoria',
      apelido: 'Extra',
      tipo: 'Banco',
      saldoInicial: 0,
      inativo: false,
      usarSaldo: true,
    },
  ];
  const novosDados = { ...dados, empresas: [emp, ...dados.empresas.slice(1)] };
  await query('UPDATE estados SET dados = $1 WHERE usuario_id = $2', [
    JSON.stringify(novosDados),
    usuarioId,
  ]);
  return { manualId, apId, arId, before: snapshotPf(novosDados) };
}

async function seedPjManual(usuarioId) {
  const dados = await getEstado(usuarioId);
  const emp = { ...dados.empresas[0] };
  const manualId = randomUUID();
  const manual = {
    id: manualId,
    codigo: 8888,
    data: '2018-03-01',
    tipo: 'Entrada',
    valor: 999,
    historico: 'Receita PJ manual antiga',
    source: 'manual',
    pago: true,
  };
  emp.lancamentos = [...(emp.lancamentos || []), manual];
  await query('UPDATE estados SET dados = $1 WHERE usuario_id = $2', [
    JSON.stringify({ ...dados, empresas: [emp] }),
    usuarioId,
  ]);
  return manualId;
}

async function vincular(tokenPj, tokenPf, emailPf) {
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

async function main() {
  console.log('=== Teste 53 — Preservação estado PF/PJ na integração ===\n');

  const emailPj = `test_pj_53_${TS}@test.local`;
  const emailPf = `test_pf_53_${TS}@test.local`;
  const pass = 'test123456';

  await cleanup([emailPj, emailPf]);

  const pj = await createUser({ email: emailPj, senha: pass, tipo: 'juridica', nomePerfil: 'PJ Preservação' });
  const pf = await createUser({ email: emailPf, senha: pass, tipo: 'fisica', nomePerfil: 'PF Preservação' });

  const tokenPj = await login(emailPj, pass);
  const tokenPf = await login(emailPf, pass);

  console.log('--- 1. Seed PF legado multi-empresa + dados ricos ---');
  const { lancLegadoId } = await seedLegacyMultiEmpresaPf(pf.id);
  const { manualId, apId, arId } = await seedPfRichData(pf.id);
  const pjManualId = await seedPjManual(pj.id);

  const pfPre = await getEstado(pf.id);
  const pfBeforeFull = snapshotPf(pfPre);
  assert(pfPre.empresas.length >= 2, 'PF seed: múltiplas empresas (legado)');
  assert(allLancamentos(pfPre).length >= 4, 'PF seed: lançamentos antigos presentes');

  console.log('--- 2. Vínculo ativo ---');
  await vincular(tokenPj, tokenPf, emailPf);

  console.log('--- 3. Operações PJ→PF (todas) ---');
  const ops = [];

  for (const [path, body] of [
    ['/integracao-pf-pj/pro-labore', { valor: 3000, data: '2026-06-15' }],
    ['/integracao-pf-pj/lucros', { valor: 5000, data: '2026-06-16' }],
    ['/integracao-pf-pj/salario', { valor: 4000, data: '2026-06-17' }],
    ['/integracao-pf-pj/transferencia', { valor: 1000, data: '2026-06-18' }],
  ]) {
    const conf = await req(path, { method: 'POST', token: tokenPj, body });
    ops.push(conf.data);
    assert(conf.data.operacao?.status === 'ok', `${path}: operação ok`);
  }

  const pfAfterOps = snapshotPf(await getEstado(pf.id));
  const pjAfterOps = allLancamentos(await getEstado(pj.id));

  assertPfPreserved(
    pfAfterOps,
    pfBeforeFull,
    [manualId, apId, arId, lancLegadoId],
    'Após 4 operações'
  );
  assert(
    pfAfterOps.lancIds.size === pfBeforeFull.lancIds.size + 4,
    'PF: +4 lançamentos integração, antigos intactos'
  );
  assert(
    allLancamentos(await getEstado(pf.id)).filter((l) => l.source === SOURCE).length === 4,
    'PF: exatamente 4 lançamentos integracao_pf_pj'
  );

  assert(pjAfterOps.some((l) => l.id === pjManualId), 'PJ: lançamento manual antigo preservado');
  assert(
    pjAfterOps.filter((l) => l.source === SOURCE).length === 4,
    'PJ: 4 lançamentos integração, manual preservado'
  );

  const pfEstadoPos = await getEstado(pf.id);
  const empCount = pfEstadoPos.empresas?.length ?? 0;
  assert(
    empCount === 1,
    `PF: estado normalizado (empresas consolidadas) após escrita segura — got ${empCount}`
  );
  assert(
    allLancamentos(pfEstadoPos).some((l) => l.id === lancLegadoId),
    'PF: lançamento da empresa secundária legado consolidado'
  );

  console.log('--- 4. Rollback remove só integração ---');
  const lastOp = ops[ops.length - 1];
  const rb = await req(`/integracao-pf-pj/operacoes/${lastOp.operacao.id}/rollback`, {
    method: 'POST',
    token: tokenPj,
  });
  assert(rb.data.removidos === 2, 'Rollback última operação: 2 lançamentos');

  const pfAfterRb = snapshotPf(await getEstado(pf.id));
  assertPfPreserved(
    pfAfterRb,
    pfBeforeFull,
    [manualId, apId, arId, lancLegadoId],
    'Após rollback'
  );
  assert(
    !pfAfterRb.lancIds.has(lastOp.lancamentoPfId),
    'Rollback: lançamento integração PF removido'
  );
  assert(
    allLancamentos(await getEstado(pf.id)).filter((l) => l.source === SOURCE).length === 3,
    'PF: restam 3 lançamentos integração após rollback parcial'
  );
  assert(
    allLancamentos(await getEstado(pj.id)).some((l) => l.id === pjManualId),
    'PJ: manual intacto após rollback'
  );
  assert(
    !allLancamentos(await getEstado(pj.id)).some((l) => l.id === lastOp.lancamentoPjId),
    'PJ: lançamento integração rollback removido'
  );

  console.log('--- 5. Rollback manual não afetado ---');
  const manualPos = allLancamentos(await getEstado(pf.id)).find((l) => l.id === manualId);
  assert(manualPos?.source === 'manual', 'Lançamento manual PF permanece após rollback');

  const apPos = allLancamentos(await getEstado(pf.id)).find((l) => l.id === apId);
  const arPos = allLancamentos(await getEstado(pf.id)).find((l) => l.id === arId);
  assert(apPos?.pago === false, 'Conta a pagar antiga ainda aberta');
  assert(arPos?.pago === false, 'Conta a receber antiga ainda aberta');

  await cleanup([emailPj, emailPf]);
  await pool.end();

  console.log('\n=== Teste 53: preservação PF/PJ — todos os testes passaram ===');
}

main().catch(async (err) => {
  console.error('\n✗', err.message);
  try { await pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
