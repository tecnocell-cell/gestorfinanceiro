/**
 * Testes Etapa 5.0C — Pró-labore PJ → PF
 * Uso: node server/test50c.js
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

async function countLancamentos(usuarioId, source) {
  const { rows } = await query('SELECT dados FROM estados WHERE usuario_id = $1', [usuarioId]);
  const emp = rows[0]?.dados?.empresas?.[0];
  return (emp?.lancamentos || []).filter((l) => l.source === source).length;
}

async function cleanup(emailPj, emailPf) {
  for (const email of [emailPj, emailPf]) {
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

async function setupVinculoAtivo(tokenPj, tokenPf, emailPf) {
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
  return criado.data.vinculo.id;
}

async function main() {
  console.log('=== Testes Etapa 5.0C — Pró-labore ===\n');

  const emailPj = `test_pj_50c_${TS}@test.local`;
  const emailPf = `test_pf_50c_${TS}@test.local`;
  const pass = 'test123456';

  await cleanup(emailPj, emailPf);

  const pj = await createUser({ email: emailPj, senha: pass, tipo: 'juridica', nomePerfil: 'Empresa 50C' });
  const pf = await createUser({ email: emailPf, senha: pass, tipo: 'fisica', nomePerfil: 'PF 50C' });

  const tokenPj = await login(emailPj, pass);
  const tokenPf = await login(emailPf, pass);

  await setupVinculoAtivo(tokenPj, tokenPf, emailPf);

  const semVinculo = await req('/integracao-pf-pj/pro-labore/preview', {
    method: 'POST',
    token: tokenPf,
    body: { valor: 100, data: '2026-06-01' },
    allowError: true,
  });
  assert(semVinculo.status === 403, 'Preview restrito à PJ');

  const preview = await req('/integracao-pf-pj/pro-labore/preview', {
    method: 'POST',
    token: tokenPj,
    body: { valor: 2500.5, data: '2026-06-01', observacao: 'Maio' },
  });
  assert(preview.data.lancamentoPj?.tipo === 'Saida', 'Preview PJ = Saída');
  assert(preview.data.lancamentoPf?.tipo === 'Entrada', 'Preview PF = Entrada');
  assert(preview.data.lancamentoPj?.valor === 2500.5, 'Preview valor correto');

  const antesPj = await countLancamentos(pj.id, 'integracao_pf_pj');
  const antesPf = await countLancamentos(pf.id, 'integracao_pf_pj');

  const conf = await req('/integracao-pf-pj/pro-labore', {
    method: 'POST',
    token: tokenPj,
    body: { valor: 2500.5, data: '2026-06-01', observacao: 'Maio' },
  });
  assert(conf.data.operacao?.status === 'ok', 'Confirma operação ok');
  assert(conf.data.lancamentoPjId && conf.data.lancamentoPfId, 'Retorna IDs dos lançamentos');

  const depoisPj = await countLancamentos(pj.id, 'integracao_pf_pj');
  const depoisPf = await countLancamentos(pf.id, 'integracao_pf_pj');
  assert(depoisPj === antesPj + 1, 'PJ +1 lançamento');
  assert(depoisPf === antesPf + 1, 'PF +1 lançamento');

  const { rows: lancPj } = await query('SELECT dados FROM estados WHERE usuario_id = $1', [pj.id]);
  const lPj = lancPj[0].dados.empresas[0].lancamentos.find((l) => l.id === conf.data.lancamentoPjId);
  assert(lPj?.tipo === 'Saida' && lPj?.source === 'integracao_pf_pj', 'Lançamento PJ metadata');
  assert(lPj?.integracaoPfPj?.tipoOperacao === 'pro_labore', 'tipoOperacao pro_labore');

  const lista = await req('/integracao-pf-pj/operacoes', { token: tokenPj });
  assert(lista.data.operacoes?.length >= 1, 'GET operacoes lista');

  const rb = await req(`/integracao-pf-pj/operacoes/${conf.data.operacao.id}/rollback`, {
    method: 'POST',
    token: tokenPj,
  });
  assert(rb.data.ok === true && rb.data.removidos === 2, 'Rollback remove 2 lançamentos');

  const finalPj = await countLancamentos(pj.id, 'integracao_pf_pj');
  const finalPf = await countLancamentos(pf.id, 'integracao_pf_pj');
  assert(finalPj === antesPj, 'PJ restaurado após rollback');
  assert(finalPf === antesPf, 'PF restaurado após rollback');

  await cleanup(emailPj, emailPf);
  await pool.end();

  console.log('\n=== Todos os testes 5.0C passaram ===');
}

main().catch(async (err) => {
  console.error('\n✗', err.message);
  try { await pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
