/**
 * Teste Etapa 5.6 — Auditoria operacional integração PF/PJ
 * Uso: node server/test56.js  (API em http://127.0.0.1:3001)
 */
import { config } from 'dotenv';
config();

import bcrypt from 'bcryptjs';
import { query, pool } from './db.js';
import { createInitialState } from './initialState.js';
import { collectAllLancamentos } from './integracaoPfPj/estadoMerge.js';
import { reaisFromCentavos } from './utils/money.js';

const BASE = `http://127.0.0.1:${process.env.PORT || 3001}/api`;
const TS = Date.now();
const VALOR_CENTAVOS = 1500000;
const VALOR_REAIS = 15000;

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

async function countLancamentosNaoIntegracao(usuarioId) {
  const { rows } = await query('SELECT dados FROM estados WHERE usuario_id = $1', [usuarioId]);
  const all = collectAllLancamentos(rows[0]?.dados || {});
  return all.filter((l) => l.source !== 'integracao_pf_pj').length;
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
  console.log('=== Teste 56 — Auditoria integração PF/PJ ===\n');

  const emailPj = `t56-pj-${TS}@test.local`;
  const emailPf = `t56-pf-${TS}@test.local`;
  const senha = 'Test@1234';

  await cleanup([emailPj, emailPf]);

  const pj = await createUser({
    email: emailPj,
    senha,
    tipo: 'juridica',
    nomePerfil: 'PJ T56',
  });
  const pf = await createUser({
    email: emailPf,
    senha,
    tipo: 'fisica',
    nomePerfil: 'PF T56',
  });

  const tokenPj = await login(emailPj, senha);
  const tokenPf = await login(emailPf, senha);

  const { data: vincData } = await req('/integracao-pf-pj/vinculo', {
    method: 'POST',
    token: tokenPj,
    body: { email: emailPf },
  });
  await req('/integracao-pf-pj/aceitar', {
    method: 'POST',
    token: tokenPf,
    body: { vinculoId: vincData.vinculo.id },
  });

  const lancAntesPj = await countLancamentosNaoIntegracao(pj.id);
  const lancAntesPf = await countLancamentosNaoIntegracao(pf.id);

  const hoje = new Date().toISOString().slice(0, 10);

  const { data: confirm } = await req('/integracao-pf-pj/transferencia', {
    method: 'POST',
    token: tokenPj,
    body: {
      valorCentavos: VALOR_CENTAVOS,
      data: hoje,
      observacao: 'audit t56',
    },
  });

  const opId = confirm.operacao?.id;
  assert(opId, 'confirmar transferência retorna operação');

  const { rows: auditConfirm } = await query(
    `SELECT acao, tipo_operacao, valor_centavos, operacao_id
     FROM integracao_pf_pj_auditoria
     WHERE operacao_id = $1 AND acao = 'confirmar'
     ORDER BY created_at DESC LIMIT 1`,
    [opId]
  );
  assert(auditConfirm.length === 1, 'confirmar cria registro de auditoria');
  assert(
    Number(auditConfirm[0].valor_centavos) === VALOR_CENTAVOS,
    `valor_centavos auditoria confirmar = ${VALOR_CENTAVOS}`
  );
  assert(
    auditConfirm[0].tipo_operacao === 'transferencia_pj_pf',
    'tipo_operacao na auditoria'
  );
  assert(
    reaisFromCentavos(Number(auditConfirm[0].valor_centavos)) === VALOR_REAIS,
    'valor_centavos corresponde a R$ 15.000,00'
  );

  const { data: lista } = await req('/integracao-pf-pj/operacoes', { token: tokenPj });
  const opLista = (lista.operacoes || []).find((o) => o.id === opId);
  assert(opLista?.criadoEm, 'GET operacoes expõe criadoEm');
  assert(
    Number(opLista.valorCentavos) === VALOR_CENTAVOS,
    'GET operacoes valorCentavos correto'
  );
  assert(opLista.valor === VALOR_REAIS, 'GET operacoes valor em reais correto');

  const lancMeioPj = await countLancamentosNaoIntegracao(pj.id);
  const lancMeioPf = await countLancamentosNaoIntegracao(pf.id);
  assert(lancMeioPj === lancAntesPj, 'confirmar não altera lançamentos antigos (PJ)');
  assert(lancMeioPf === lancAntesPf, 'confirmar não altera lançamentos antigos (PF)');

  await req(`/integracao-pf-pj/operacoes/${opId}/rollback`, {
    method: 'POST',
    token: tokenPj,
  });

  const { rows: auditRollback } = await query(
    `SELECT acao, valor_centavos FROM integracao_pf_pj_auditoria
     WHERE operacao_id = $1 AND acao = 'rollback'`,
    [opId]
  );
  assert(auditRollback.length >= 1, 'rollback cria registro de auditoria');
  assert(
    Number(auditRollback[0].valor_centavos) === VALOR_CENTAVOS,
    'valor_centavos auditoria rollback igual ao da operação'
  );

  const { data: lista2 } = await req('/integracao-pf-pj/operacoes', { token: tokenPj });
  const opRollback = (lista2.operacoes || []).find((o) => o.id === opId);
  assert(opRollback?.status === 'rollback', 'operação em status rollback');
  assert(opRollback?.desfeitoEm, 'GET operacoes expõe desfeitoEm após rollback');

  const lancDepoisPj = await countLancamentosNaoIntegracao(pj.id);
  const lancDepoisPf = await countLancamentosNaoIntegracao(pf.id);
  assert(lancDepoisPj === lancAntesPj, 'rollback não altera lançamentos antigos (PJ)');
  assert(lancDepoisPf === lancAntesPf, 'rollback não altera lançamentos antigos (PF)');

  await cleanup([emailPj, emailPf]);
  console.log('\n=== Teste 56 OK ===');
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
