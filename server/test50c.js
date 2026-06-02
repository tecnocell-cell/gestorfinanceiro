/**
 * Testes Etapa 5.0C / 5.0C.1 — Pró-labore PJ → PF (auditoria)
 * Uso: node server/test50c.js
 */
import { config } from 'dotenv';
config();

import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { query, pool } from './db.js';
import { createInitialState } from './initialState.js';
import { isPessoaJuridica, normalizeTipoPerfil } from './profileTipo.js';

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

async function countLancamentos(usuarioId, source) {
  const lancs = await getLancamentos(usuarioId);
  return lancs.filter((l) => l.source === source).length;
}

async function addManualLancamento(usuarioId) {
  const { rows } = await query('SELECT dados FROM estados WHERE usuario_id = $1', [usuarioId]);
  const dados = rows[0].dados;
  const emp = { ...dados.empresas[0] };
  const lanc = {
    id: randomUUID(),
    codigo: 9999,
    data: '2020-01-01',
    tipo: 'Entrada',
    valor: 1,
    historico: 'Lançamento manual auditoria',
    source: 'manual',
    pago: true,
  };
  const novosDados = {
    ...dados,
    empresas: [{ ...emp, lancamentos: [...(emp.lancamentos || []), lanc] }],
  };
  await query('UPDATE estados SET dados = $1 WHERE usuario_id = $2', [
    JSON.stringify(novosDados),
    usuarioId,
  ]);
  return lanc.id;
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
  console.log('=== Testes Etapa 5.0C.1 — Auditoria Pró-labore ===\n');

  const emailPj = `test_pj_50c1_${TS}@test.local`;
  const emailPj2 = `test_pj2_50c1_${TS}@test.local`;
  const emailPf = `test_pf_50c1_${TS}@test.local`;
  const pass = 'test123456';

  await cleanup([emailPj, emailPj2, emailPf]);

  const pj = await createUser({ email: emailPj, senha: pass, tipo: 'juridica', nomePerfil: 'Empresa Audit PJ' });
  const pj2 = await createUser({ email: emailPj2, senha: pass, tipo: 'juridica', nomePerfil: 'Outra PJ' });
  const pf = await createUser({ email: emailPf, senha: pass, tipo: 'fisica', nomePerfil: 'PF Audit' });

  const tokenPj = await login(emailPj, pass);
  const tokenPj2 = await login(emailPj2, pass);
  const tokenPf = await login(emailPf, pass);

  console.log('--- 0. tipo_perfil vazio (retrocompat) ---');
  assert(normalizeTipoPerfil(null) === 'juridica', 'normalizeTipoPerfil(null) => juridica');
  assert(normalizeTipoPerfil('') === 'juridica', 'normalizeTipoPerfil("") => juridica');
  assert(isPessoaJuridica(null), 'isPessoaJuridica(null)');

  const emailPjNull = `test_pj_null_${TS}@test.local`;
  await cleanup([emailPjNull]);
  const hashNull = await bcrypt.hash(pass, 12);
  const insNull = await query(
    `INSERT INTO usuarios (email, senha_hash, nome, role, ativo, tipo_perfil, nome_perfil, email_verificado)
     VALUES ($1,$2,'PJ Null','user',true,'','Empresa Null',true) RETURNING id`,
    [emailPjNull, hashNull]
  );
  const stNull = createInitialState('juridica', 'Empresa Null');
  await query('INSERT INTO estados (usuario_id, dados) VALUES ($1,$2)', [
    insNull.rows[0].id,
    JSON.stringify(stNull),
  ]);
  const tokenPjNull = await login(emailPjNull, pass);
  const meNull = await req('/auth/me', { token: tokenPjNull });
  assert(meNull.data.user?.tipo_perfil === 'juridica', 'auth/me default juridica quando vazio no banco');

  const prevNull = await req('/integracao-pf-pj/pro-labore/preview', {
    method: 'POST',
    token: tokenPjNull,
    body: { valor: 100, data: '2026-06-01' },
    allowError: true,
  });
  assert(prevNull.status !== 403, 'tipo_perfil vazio: preview não retorna 403 restrito PJ');
  assert(prevNull.status === 422, 'tipo_perfil vazio: preview sem vínculo = 422');

  console.log('--- 1. Vínculo ---');

  const semVincPrev = await req('/integracao-pf-pj/pro-labore/preview', {
    method: 'POST',
    token: tokenPj,
    body: { valor: 100, data: '2026-06-01' },
    allowError: true,
  });
  assert(semVincPrev.status === 422, 'PJ sem vínculo: preview bloqueado (422)');

  const semVincConf = await req('/integracao-pf-pj/pro-labore', {
    method: 'POST',
    token: tokenPj,
    body: { valor: 100, data: '2026-06-01' },
    allowError: true,
  });
  assert(semVincConf.status === 422, 'PJ sem vínculo: confirmar bloqueado (422)');

  const criado = await req('/integracao-pf-pj/vinculo', {
    method: 'POST',
    token: tokenPj,
    body: { email: emailPf },
  });
  assert(criado.data.vinculo?.status === 'pendente', 'Vínculo criado pendente');

  const pendPrev = await req('/integracao-pf-pj/pro-labore/preview', {
    method: 'POST',
    token: tokenPj,
    body: { valor: 100, data: '2026-06-01' },
    allowError: true,
  });
  assert(pendPrev.status === 422, 'Vínculo pendente: preview bloqueado (422)');

  await req('/integracao-pf-pj/aceitar', {
    method: 'POST',
    token: tokenPf,
    body: { vinculoId: criado.data.vinculo.id },
  });

  const ativo = await req('/integracao-pf-pj/vinculo', { token: tokenPj });
  assert(ativo.data.vinculo?.status === 'ativo', 'Vínculo ativo após aceite');

  const ativoPrev = await req('/integracao-pf-pj/pro-labore/preview', {
    method: 'POST',
    token: tokenPj,
    body: { valor: 3000, data: '2026-06-15', observacao: 'Jun' },
  });
  assert(ativoPrev.status === 200, 'Vínculo ativo: preview permitido');

  console.log('--- 2. Pró-labore (bilateral) ---');

  const antesPj = await countLancamentos(pj.id, 'integracao_pf_pj');
  const antesPf = await countLancamentos(pf.id, 'integracao_pf_pj');
  const manualId = await addManualLancamento(pj.id);

  const conf = await req('/integracao-pf-pj/pro-labore', {
    method: 'POST',
    token: tokenPj,
    body: { valor: 3000, data: '2026-06-15', observacao: 'Jun' },
  });
  assert(conf.data.operacao?.status === 'ok', 'Operação gravada ok');

  const lancsPj = await getLancamentos(pj.id);
  const lancsPf = await getLancamentos(pf.id);
  const lPj = lancsPj.find((l) => l.id === conf.data.lancamentoPjId);
  const lPf = lancsPf.find((l) => l.id === conf.data.lancamentoPfId);

  assert(lPj?.tipo === 'Saida', 'PJ: tipo Saída');
  assert(lPf?.tipo === 'Entrada', 'PF: tipo Entrada');
  assert(!lPf?.contaSaidaId, 'PF: sem contaSaidaId');
  assert(!!lPf?.contaEntradaId, 'PF: com contaEntradaId');
  assert(lPj?.valor === 3000 && lPf?.valor === 3000, 'Valores iguais nos dois lados');
  assert(lPj?.data === '2026-06-15' && lPf?.data === '2026-06-15', 'Datas iguais');
  assert(lPj?.historico?.includes('Pró-labore'), 'PJ: histórico coerente');
  assert(lPf?.historico?.includes('recebido'), 'PF: histórico coerente');
  assert(lPj?.integracaoPfPj?.operacaoId === conf.data.operacao.id, 'PJ: operacaoId');
  assert(lPf?.integracaoPfPj?.operacaoId === conf.data.operacao.id, 'PF: operacaoId');
  assert(lPj?.integracaoPfPj?.lancamentoParId === lPf.id, 'PJ: lancamentoParId → PF');
  assert(lPf?.integracaoPfPj?.lancamentoParId === lPj.id, 'PF: lancamentoParId → PJ');
  assert(lPj?.tipoOperacao === 'pro_labore' && lPf?.tipoOperacao === 'pro_labore', 'tipoOperacao no root');

  console.log('--- 3. Rollback ---');

  const rb = await req(`/integracao-pf-pj/operacoes/${conf.data.operacao.id}/rollback`, {
    method: 'POST',
    token: tokenPj,
  });
  assert(rb.data.removidos === 2, 'Rollback remove 2 lançamentos integração');

  const manualRestante = (await getLancamentos(pj.id)).find((l) => l.id === manualId);
  assert(manualRestante?.source === 'manual', 'Rollback não remove lançamento manual');

  const { rows: opRows } = await query(
    'SELECT status FROM integracao_pf_pj_operacoes WHERE id = $1',
    [conf.data.operacao.id]
  );
  assert(opRows[0]?.status === 'rollback', 'Operação marcada rollback');

  const rb2 = await req(`/integracao-pf-pj/operacoes/${conf.data.operacao.id}/rollback`, {
    method: 'POST',
    token: tokenPj,
    allowError: true,
  });
  assert(rb2.status === 409, 'Segundo rollback retorna 409');

  console.log('--- 4. Segurança ---');

  const pfPrev = await req('/integracao-pf-pj/pro-labore/preview', {
    method: 'POST',
    token: tokenPf,
    body: { valor: 100, data: '2026-06-01' },
    allowError: true,
  });
  assert(pfPrev.status === 403, 'PF não executa preview PJ');

  const pfConf = await req('/integracao-pf-pj/pro-labore', {
    method: 'POST',
    token: tokenPf,
    body: { valor: 100, data: '2026-06-01' },
    allowError: true,
  });
  assert(pfConf.status === 403, 'PF não executa pró-labore');

  const pfOps = await req('/integracao-pf-pj/operacoes', { token: tokenPf, allowError: true });
  assert(pfOps.status === 403, 'PF não lista operações PJ');

  const conf2 = await req('/integracao-pf-pj/pro-labore', {
    method: 'POST',
    token: tokenPj,
    body: { valor: 500, data: '2026-06-20' },
  });

  const rbOutro = await req(`/integracao-pf-pj/operacoes/${conf2.data.operacao.id}/rollback`, {
    method: 'POST',
    token: tokenPj2,
    allowError: true,
  });
  assert(rbOutro.status === 404, 'Outra PJ não desfaz operação alheia');

  await req(`/integracao-pf-pj/operacoes/${conf2.data.operacao.id}/rollback`, {
    method: 'POST',
    token: tokenPj,
  });

  console.log('--- 5. Vínculo revogado ---');

  await req('/integracao-pf-pj/vinculo', { method: 'DELETE', token: tokenPj });

  const revPrev = await req('/integracao-pf-pj/pro-labore/preview', {
    method: 'POST',
    token: tokenPj,
    body: { valor: 100, data: '2026-06-01' },
    allowError: true,
  });
  assert(revPrev.status === 422, 'Vínculo revogado: preview bloqueado (422)');

  const lista = await req('/integracao-pf-pj/operacoes', { token: tokenPj });
  assert(lista.data.operacoes?.some((o) => o.status === 'rollback'), 'Histórico inclui operação rollback');

  await cleanup([emailPj, emailPj2, emailPf, emailPjNull]);
  await pool.end();

  console.log('\n=== Auditoria 5.0C.1: todos os testes passaram ===');
}

main().catch(async (err) => {
  console.error('\n✗', err.message);
  try { await pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
