/**
 * Testes Etapas 5.2 / 5.3 — Salário e Transferência PJ → PF
 * Uso: node server/test52.js
 */
import { config } from 'dotenv';
config();

import bcrypt from 'bcryptjs';
import { query, pool } from './db.js';
import { createInitialState } from './initialState.js';

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
     VALUES ($1,$2,$3,'user',true,$4,$5,true) RETURNING id, email`,
    [email, hash, nomePerfil, tipo, nomePerfil]
  );
  const st = createInitialState(tipo, nomePerfil);
  await query('INSERT INTO estados (usuario_id, dados) VALUES ($1,$2)', [ins.rows[0].id, JSON.stringify(st)]);
  return ins.rows[0];
}

async function login(email, senha) {
  const { data } = await req('/auth/login', { method: 'POST', body: { email, senha } });
  return data.token;
}

function getLancamentos(usuarioId) {
  return query('SELECT dados FROM estados WHERE usuario_id = $1', [usuarioId]).then((r) => {
    const emp = r.rows[0]?.dados?.empresas?.[0];
    return emp?.lancamentos || [];
  });
}

async function vinculoAtivo(tokenPj, tokenPf, vinculoId) {
  await req('/integracao-pf-pj/aceitar', {
    method: 'POST',
    token: tokenPf,
    body: { vinculoId },
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

async function testOperacao({
  label,
  pathBase,
  tipoOperacao,
  pj,
  pf,
  tokenPj,
  valor,
  data,
  obs,
  historicoPjIncludes,
  historicoPfIncludes,
}) {
  console.log(`\n--- ${label} ---`);

  const prev = await req(`/integracao-pf-pj/${pathBase}/preview`, {
    method: 'POST',
    token: tokenPj,
    body: { valor, data, observacao: obs },
  });
  assert(prev.data.tipoOperacao === tipoOperacao, `${label}: preview tipo`);
  assert(prev.data.lancamentoPj?.tipo === 'Saida', `${label}: preview PJ Saída`);
  assert(prev.data.lancamentoPf?.tipo === 'Entrada', `${label}: preview PF Entrada`);

  const conf = await req(`/integracao-pf-pj/${pathBase}`, {
    method: 'POST',
    token: tokenPj,
    body: { valor, data, observacao: obs },
  });
  assert(conf.status === 201, `${label}: confirmação 201`);

  const lPj = (await getLancamentos(pj.id)).find((l) => l.id === conf.data.lancamentoPjId);
  const lPf = (await getLancamentos(pf.id)).find((l) => l.id === conf.data.lancamentoPfId);

  assert(lPj?.tipo === 'Saida' && lPf?.tipo === 'Entrada', `${label}: tipos lançamento`);
  assert(lPj?.valor === valor && lPf?.valor === valor, `${label}: valores iguais`);
  assert(lPj?.tipoOperacao === tipoOperacao, `${label}: tipoOperacao PJ`);
  assert(lPf?.tipoOperacao === tipoOperacao, `${label}: tipoOperacao PF`);
  assert(lPj?.integracaoPfPj?.lancamentoParId === lPf.id, `${label}: par PJ→PF`);

  if (historicoPjIncludes) {
    assert(lPj?.historico?.includes(historicoPjIncludes), `${label}: histórico PJ`);
  }
  if (historicoPfIncludes) {
    assert(lPf?.historico?.includes(historicoPfIncludes), `${label}: histórico PF`);
  }

  const lista = await req('/integracao-pf-pj/operacoes', { token: tokenPj });
  const op = lista.data.operacoes?.find((o) => o.id === conf.data.operacao.id);
  assert(op?.tipoOperacao === tipoOperacao, `${label}: histórico API`);

  const rb = await req(`/integracao-pf-pj/operacoes/${conf.data.operacao.id}/rollback`, {
    method: 'POST',
    token: tokenPj,
  });
  assert(rb.data.removidos === 2, `${label}: rollback remove 2`);

  const opRb = (await req('/integracao-pf-pj/operacoes', { token: tokenPj }))
    .data.operacoes?.find((o) => o.id === conf.data.operacao.id);
  assert(opRb?.status === 'rollback', `${label}: status rollback`);

  return conf;
}

async function main() {
  console.log('=== Testes Etapas 5.2 / 5.3 — Salário e Transferência ===\n');

  const emailPj = `test_pj_52_${TS}@test.local`;
  const emailPf = `test_pf_52_${TS}@test.local`;
  const pass = 'test123456';

  await cleanup([emailPj, emailPf]);

  const pj = await createUser({ email: emailPj, senha: pass, tipo: 'juridica', nomePerfil: 'PJ 52' });
  const pf = await createUser({ email: emailPf, senha: pass, tipo: 'fisica', nomePerfil: 'PF 52' });

  const tokenPj = await login(emailPj, pass);
  const tokenPf = await login(emailPf, pass);

  const semSal = await req('/integracao-pf-pj/salario/preview', {
    method: 'POST',
    token: tokenPj,
    body: { valor: 100, data: '2026-08-01' },
    allowError: true,
  });
  assert(semSal.status === 422, 'Sem vínculo: salário bloqueado');

  const criado = await req('/integracao-pf-pj/vinculo', {
    method: 'POST',
    token: tokenPj,
    body: { email: emailPf },
  });

  const pend = await req('/integracao-pf-pj/transferencia/preview', {
    method: 'POST',
    token: tokenPj,
    body: { valor: 100, data: '2026-08-01' },
    allowError: true,
  });
  assert(pend.status === 422, 'Vínculo pendente: transferência bloqueada');

  await vinculoAtivo(tokenPj, tokenPf, criado.data.vinculo.id);

  await testOperacao({
    label: '5.2 Salário',
    pathBase: 'salario',
    tipoOperacao: 'salario',
    pj,
    pf,
    tokenPj,
    valor: 8500,
    data: '2026-08-10',
    obs: 'Agosto',
    historicoPjIncludes: 'Salário',
    historicoPfIncludes: 'Salário recebido',
  });

  await testOperacao({
    label: '5.3 Transferência PJ→PF',
    pathBase: 'transferencia',
    tipoOperacao: 'transferencia_pj_pf',
    pj,
    pf,
    tokenPj,
    valor: 12000,
    data: '2026-08-12',
    obs: 'Repasse',
    historicoPjIncludes: 'Transferência PJ',
    historicoPfIncludes: 'Transferência recebida',
  });

  const proPrev = await req('/integracao-pf-pj/pro-labore/preview', {
    method: 'POST',
    token: tokenPj,
    body: { valor: 500, data: '2026-08-15' },
  });
  assert(proPrev.status === 200, 'Pró-labore ainda funciona após 5.2/5.3');

  await cleanup([emailPj, emailPf]);
  await pool.end();

  console.log('\n=== Etapas 5.2 e 5.3: todos os testes passaram ===');
}

main().catch(async (err) => {
  console.error('\n✗', err.message);
  try { await pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
