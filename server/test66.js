/**
 * Testes Etapa 6.6 — Limites por plano e bloqueio premium
 * Uso: npm run test:66  (servidor: npm run server)
 */
import { config } from 'dotenv';
config();

import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { query, pool } from './db.js';
import { createInitialState } from './initialState.js';
import { runMigrations } from './migrate.js';

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
    `INSERT INTO usuarios (
       email, senha_hash, nome, role, ativo, tipo_perfil, nome_perfil, email_verificado
     ) VALUES ($1,$2,$3,'user',true,$4,$5,true) RETURNING id`,
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

async function getState(token) {
  const { data } = await req('/state', { token });
  return data.dados;
}

async function putState(token, dados) {
  return req('/state', { token, method: 'PUT', body: { dados }, allowError: true });
}

async function cleanup(emails) {
  for (const email of emails) {
    const { rows } = await query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (!rows.length) continue;
    const id = rows[0].id;
    await query('DELETE FROM pagamentos WHERE usuario_id = $1', [id]).catch(() => {});
    await query('DELETE FROM faturas WHERE usuario_id = $1', [id]).catch(() => {});
    await query('DELETE FROM assinaturas WHERE usuario_id = $1', [id]);
    await query('DELETE FROM estados WHERE usuario_id = $1', [id]);
    await query('DELETE FROM usuarios WHERE id = $1', [id]);
  }
}

async function main() {
  console.log('=== Testes Etapa 6.6 — Limites e bloqueio premium ===\n');
  await runMigrations();

  const emailPf = `test_66_pf_${TS}@test.local`;
  const emailPj = `test_66_pj_${TS}@test.local`;
  const pass = 'test123456';
  await cleanup([emailPf, emailPj]);

  await createUser({ email: emailPf, senha: pass, tipo: 'fisica', nomePerfil: 'PF 66' });
  await createUser({ email: emailPj, senha: pass, tipo: 'juridica', nomePerfil: 'PJ 66' });
  const tokenPf = await login(emailPf, pass);
  const tokenPj = await login(emailPj, pass);

  await req('/billing/assinatura', { token: tokenPf });
  await req('/billing/assinatura', { token: tokenPj });

  console.log('--- GET /billing/usage ---');
  const { data: usagePf } = await req('/billing/usage', { token: tokenPf });
  assert(usagePf.plano?.slug === 'pf_basico', 'usage PF plano basico');
  assert(usagePf.recursos?.openFinance === false, 'usage PF sem openFinance real');
  assert(usagePf.uso?.lancamentos != null, 'usage expõe lançamentos');

  console.log('\n--- PF Básico: Open Finance real bloqueado, mock OK ---');
  const { status: pluggySt } = await req('/open-finance/connect/init', {
    token: tokenPf,
    method: 'POST',
    allowError: true,
  });
  assert(pluggySt === 403, 'PF pluggy init 403');

  const { status: mockSt } = await req('/open-finance/connections/mock', {
    token: tokenPf,
    method: 'POST',
    body: {},
  });
  assert(mockSt === 201, 'PF mock connection OK');

  console.log('\n--- PJ Start: projetos bloqueados (feature) ---');
  const dadosPj = await getState(tokenPj);
  const emp = dadosPj.empresas[0];
  const before = (emp.projetos || []).length;
  emp.projetos = [
    ...(emp.projetos || []),
    { id: randomUUID(), nome: 'Projeto Teste 66', status: 'ativo', clienteId: null },
  ];
  const { status: projSt, data: projData } = await putState(tokenPj, dadosPj);
  assert(projSt === 403, 'PJ Start novo projeto 403');
  assert(projData.code === 'PLAN_FEATURE' || projData.recurso === 'projetos', 'código feature projetos');

  console.log('\n--- Limite de lançamentos (pf_basico temporário) ---');
  await query(
    `UPDATE planos SET recursos = recursos || '{"limiteLancamentos": 2}'::jsonb WHERE slug = 'pf_basico'`
  );
  const { data: usageLim } = await req('/billing/usage', { token: tokenPf });
  assert(usageLim.limites?.lancamentos === 2, 'limite lançamentos 2 no usage');

  const dadosPf = await getState(tokenPf);
  const empPf = dadosPf.empresas[0];
  empPf.lancamentos = [
    { id: randomUUID(), tipo: 'Saida', valor: 10, data: '2026-01-01', descricao: 'L1' },
    { id: randomUUID(), tipo: 'Saida', valor: 20, data: '2026-01-02', descricao: 'L2' },
  ];
  await putState(tokenPf, dadosPf);

  const dadosPf2 = await getState(tokenPf);
  dadosPf2.empresas[0].lancamentos.push({
    id: randomUUID(),
    tipo: 'Saida',
    valor: 30,
    data: '2026-01-03',
    descricao: 'L3',
  });
  const { status: lancSt, data: lancData } = await putState(tokenPf, dadosPf2);
  assert(lancSt === 403, `terceiro lançamento bloqueado (got ${lancSt})`);
  assert(lancData.code === 'PLAN_LIMIT', 'código PLAN_LIMIT lançamentos');

  await query(
    `UPDATE planos SET recursos = recursos - 'limiteLancamentos' WHERE slug = 'pf_basico'`
  );

  console.log('\n--- PF: integração PF/PJ indisponível no plano ---');
  assert(usagePf.recursos?.integracaoPfPj === false, 'PF básico sem integracaoPfPj');

  console.log('\n--- Vencida bloqueia premium (integração) ---');
  const { rows: uPj } = await query('SELECT id FROM usuarios WHERE email = $1', [emailPj]);
  const { rows: aPj } = await query('SELECT id FROM assinaturas WHERE usuario_id = $1', [uPj[0].id]);
  await query(
    `UPDATE assinaturas SET status = 'vencida', trial_ate = NULL, fim_em = NOW() - INTERVAL '1 day' WHERE id = $1`,
    [aPj[0].id]
  );
  const { status: intVenc } = await req('/integracao-pf-pj/agendamentos', {
    token: tokenPj,
    method: 'POST',
    body: { tipo: 'pro_labore', diaMes: 5, valorCentavos: 100000 },
    allowError: true,
  });
  assert(intVenc === 403, 'vencida bloqueia POST integração');

  console.log('\n--- Atrasada: aviso sem bloqueio imediato ---');
  await query(
    `UPDATE assinaturas SET status = 'ativa', fim_em = NOW() + INTERVAL '30 days', trial_ate = NULL WHERE id = $1`,
    [aPj[0].id]
  );
  await query(
    `UPDATE faturas SET status = 'cancelada' WHERE assinatura_id = $1 AND status = 'pendente'`,
    [aPj[0].id]
  );
  const vencAtr = new Date();
  vencAtr.setDate(vencAtr.getDate() - 5);
  await query(
    `INSERT INTO faturas (usuario_id, assinatura_id, gateway, valor_centavos, status, vencimento)
     VALUES ($1, $2, 'asaas', 2990, 'pendente', $3)`,
    [uPj[0].id, aPj[0].id, vencAtr.toISOString().slice(0, 10)]
  );
  const { data: usageAtr } = await req('/billing/usage', { token: tokenPj });
  assert(usageAtr.status === 'atrasada', 'lifecycle mantém status atrasada com fatura vencida');
  assert(
    usageAtr.avisos?.some((a) => /atraso/i.test(a)),
    'usage atrasada contém aviso'
  );
  const { status: prevAtr } = await req('/integracao-pf-pj/pro-labore/preview', {
    token: tokenPj,
    method: 'POST',
    body: { valorCentavos: 50000 },
    allowError: true,
  });
  assert(
    prevAtr !== 403,
    'atrasada: preview não bloqueado por plano (403)'
  );

  console.log('\n--- Importação OFX preview continua ---');
  const ofxSample = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>20260101120000
<LANGUAGE>POR
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>001
<ACCTID>12345
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260101
<DTEND>20260131
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260115120000
<TRNAMT>-10.00
<FITID>fit-66-1
<MEMO>Teste 66
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

  const { status: ofxSt } = await req('/importacoes/ofx-preview', {
    token: tokenPf,
    method: 'POST',
    body: { fileName: 'test66.ofx', fileContent: ofxSample },
    allowError: true,
  });
  assert(ofxSt === 200, 'OFX preview disponível com plano básico');

  await cleanup([emailPf, emailPj]);
  console.log('\n=== Todos os testes 6.6 passaram ===\n');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  pool.end().finally(() => process.exit(1));
});
