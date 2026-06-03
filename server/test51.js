/**
 * Testes Etapa 5.1 — Distribuição de Lucros PJ → PF
 * Uso: node server/test51.js
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
  console.log('=== Testes Etapa 5.1 — Distribuição de Lucros ===\n');

  const emailPj = `test_pj_51_${TS}@test.local`;
  const emailPf = `test_pf_51_${TS}@test.local`;
  const pass = 'test123456';

  await cleanup([emailPj, emailPf]);

  const pj = await createUser({ email: emailPj, senha: pass, tipo: 'juridica', nomePerfil: 'PJ Lucros' });
  const pf = await createUser({ email: emailPf, senha: pass, tipo: 'fisica', nomePerfil: 'PF Lucros' });

  const tokenPj = await login(emailPj, pass);
  const tokenPf = await login(emailPf, pass);

  console.log('--- Vínculo ---');

  const semVinc = await req('/integracao-pf-pj/lucros/preview', {
    method: 'POST',
    token: tokenPj,
    body: { valor: 100, data: '2026-07-01' },
    allowError: true,
  });
  assert(semVinc.status === 422, `Sem vínculo: preview bloqueado (got ${semVinc.status})`);

  const criado = await req('/integracao-pf-pj/vinculo', {
    method: 'POST',
    token: tokenPj,
    body: { email: emailPf },
  });

  const pend = await req('/integracao-pf-pj/lucros/preview', {
    method: 'POST',
    token: tokenPj,
    body: { valor: 100, data: '2026-07-01' },
    allowError: true,
  });
  assert(pend.status === 422, 'Vínculo pendente: preview bloqueado');

  await req('/integracao-pf-pj/aceitar', {
    method: 'POST',
    token: tokenPf,
    body: { vinculoId: criado.data.vinculo.id },
  });

  console.log('--- Preview e confirmação ---');

  const prev = await req('/integracao-pf-pj/lucros/preview', {
    method: 'POST',
    token: tokenPj,
    body: { valor: 15000, data: '2026-07-15', observacao: 'Exercício 2025' },
  });
  assert(prev.data.tipoOperacao === 'distribuicao_lucros', 'Preview tipo distribuicao_lucros');
  assert(prev.data.lancamentoPj?.tipo === 'Saida', 'Preview PJ Saída');
  assert(prev.data.lancamentoPf?.tipo === 'Entrada', 'Preview PF Entrada');

  const conf = await req('/integracao-pf-pj/lucros', {
    method: 'POST',
    token: tokenPj,
    body: { valor: 15000, data: '2026-07-15', observacao: 'Exercício 2025' },
  });
  assert(conf.status === 201, 'Confirmação 201');

  const lPj = (await getLancamentos(pj.id)).find((l) => l.id === conf.data.lancamentoPjId);
  const lPf = (await getLancamentos(pf.id)).find((l) => l.id === conf.data.lancamentoPfId);

  assert(lPj?.tipo === 'Saida' && lPf?.tipo === 'Entrada', 'Tipos PJ/PF');
  assert(lPj?.valor === 15000 && lPf?.valor === 15000, 'Valores iguais');
  assert(lPj?.data === '2026-07-15', 'Data igual');
  assert(lPj?.tipoOperacao === 'distribuicao_lucros', 'tipoOperacao PJ');
  assert(lPf?.tipoOperacao === 'distribuicao_lucros', 'tipoOperacao PF');
  assert(lPj?.source === 'integracao_pf_pj', 'source PJ');
  assert(lPj?.integracaoPfPj?.lancamentoParId === lPf.id, 'lancamentoParId cruzado');
  assert(lPf?.integracaoPfPj?.lancamentoParId === lPj.id, 'lancamentoParId PF→PJ');
  assert(lPj?.historico?.includes('Distribuição de lucros'), 'Histórico PJ');
  assert(lPf?.historico?.includes('Distribuição de Lucros recebida'), 'Histórico PF');

  console.log('--- Histórico ---');

  const lista = await req('/integracao-pf-pj/operacoes', { token: tokenPj });
  const op = lista.data.operacoes?.find((o) => o.id === conf.data.operacao.id);
  assert(op?.tipoOperacao === 'distribuicao_lucros', 'Histórico lista operação lucros');
  assert(op?.status === 'ok', 'Status ok no histórico');

  console.log('--- Rollback ---');

  const rb = await req(`/integracao-pf-pj/operacoes/${conf.data.operacao.id}/rollback`, {
    method: 'POST',
    token: tokenPj,
  });
  assert(rb.data.removidos === 2, 'Rollback remove 2 lançamentos');

  const lista2 = await req('/integracao-pf-pj/operacoes', { token: tokenPj });
  const opRb = lista2.data.operacoes?.find((o) => o.id === conf.data.operacao.id);
  assert(opRb?.status === 'rollback', 'Histórico status rollback');

  console.log('--- Vínculo revogado ---');

  await req('/integracao-pf-pj/vinculo', { method: 'DELETE', token: tokenPj });

  const rev = await req('/integracao-pf-pj/lucros', {
    method: 'POST',
    token: tokenPj,
    body: { valor: 100, data: '2026-07-01' },
    allowError: true,
  });
  assert(rev.status === 422, 'Revogado: confirmar bloqueado');

  await cleanup([emailPj, emailPf]);
  await pool.end();

  console.log('\n=== Etapa 5.1: todos os testes passaram ===');
}

main().catch(async (err) => {
  console.error('\n✗', err.message);
  try { await pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
