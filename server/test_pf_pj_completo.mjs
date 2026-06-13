/**
 * Teste completo PF + PJ — verifica correção do initialState.js
 * 24 cats PJ / 18 cats PF + migração automática de usuários existentes
 */
import { config } from 'dotenv';
config();

import bcrypt from 'bcryptjs';
import { query, pool } from './db.js';
import { createInitialState } from './initialState.js';
import { runMigrations } from './migrate.js';

const BASE = 'http://localhost:3001';
const TS = Date.now();
const PASS = 'Teste123!';
let passed = 0, failed = 0;

function ok(label, val) {
  if (val) { console.log(`  ✓ ${label}`); passed++; }
  else     { console.error(`  ✗ ${label}`); failed++; }
}

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function createUser(email, nome, tipo) {
  const hash = await bcrypt.hash(PASS, 12);
  const ins = await query(
    `INSERT INTO usuarios (email, senha_hash, nome, role, ativo, tipo_perfil, nome_perfil, email_verificado)
     VALUES ($1,$2,$3,'user',true,$4,$5,true) RETURNING id`,
    [email, hash, nome, tipo, nome]
  );
  const st = createInitialState(tipo, nome);
  await query('INSERT INTO estados (usuario_id, dados) VALUES ($1,$2)', [ins.rows[0].id, JSON.stringify(st)]);
  return ins.rows[0].id;
}

async function login(email) {
  const { data } = await req('/auth/login', { method: 'POST', body: { email, senha: PASS } });
  return data.token;
}

async function getState(token) {
  const { data } = await req('/state', { token });
  return data.dados;
}

async function putState(token, dados) {
  await req('/state', { method: 'PUT', body: { dados }, token });
}

async function cleanup(emails) {
  for (const email of emails) {
    const { rows } = await query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (!rows.length) continue;
    const id = rows[0].id;
    await query('DELETE FROM estados WHERE usuario_id = $1', [id]);
    await query('DELETE FROM usuarios WHERE id = $1', [id]);
  }
}

const emailPJ = `test_pj_fix_${TS}@test.local`;
const emailPF = `test_pf_fix_${TS}@test.local`;

console.log('\n=== TESTE COMPLETO PF + PJ — initialState fix ===\n');
await runMigrations();
await cleanup([emailPJ, emailPF]);

// ─── Pessoa Jurídica ─────────────────────────────────────────────────────────
console.log('── Pessoa Jurídica ──');
const uidPJ = await createUser(emailPJ, 'Empresa Fix', 'juridica');
const tokenPJ = await login(emailPJ);
ok('registro PJ + login ok', !!tokenPJ);

const statePJ = await getState(tokenPJ);
const empPJ = statePJ?.empresas?.[0];
const planoPJ = empPJ?.planoContas || [];

ok('empresa ativa', !!empPJ);
ok('tipo juridica', empPJ?.tipo === 'juridica');
ok('planoContas = 24 categorias', planoPJ.length === 24);

const recPJ  = planoPJ.filter(c => c.classificacao === 'RECEITA');
const custPJ = planoPJ.filter(c => c.classificacao === 'CUSTO');
const despPJ = planoPJ.filter(c => c.classificacao === 'DESPESA');
const impPJ  = planoPJ.filter(c => c.classificacao === 'IMPOSTO');
ok('PJ: 5 receitas',   recPJ.length === 5);
ok('PJ: 4 custos',     custPJ.length === 4);
ok('PJ: 11 despesas',  despPJ.length === 11);
ok('PJ: 4 impostos',   impPJ.length === 4);
ok('PJ: todas com icone',    planoPJ.every(c => c.icone));
ok('PJ: todas com cor',      planoPJ.every(c => c.cor));
ok('PJ: todas sistema=true', planoPJ.every(c => c.sistema === true));
ok('PJ: Vendas de Produtos',  planoPJ.some(c => c.descricao === 'Vendas de Produtos'));
ok('PJ: Servicos Prestados',  planoPJ.some(c => c.descricao === 'Serviços Prestados'));
ok('PJ: Folha de Pagamento',  planoPJ.some(c => c.descricao === 'Folha de Pagamento'));
ok('PJ: Simples Nacional',    planoPJ.some(c => c.descricao === 'Simples Nacional'));
ok('PJ: Custo de Mercadoria', planoPJ.some(c => c.descricao === 'Custo de Mercadoria'));
ok('PJ: ISS / ICMS / IPI',   planoPJ.some(c => c.descricao === 'ISS / ICMS / IPI'));
ok('PJ: TI / Software',      planoPJ.some(c => c.descricao === 'TI / Software'));
ok('PJ: Pro-Labore',         planoPJ.some(c => c.descricao === 'Pró-Labore'));
ok('PJ: onboarding nao concluido', empPJ.onboardingConcluido === false);
ok('PJ: etapa pj-1',               empPJ.onboardingEtapa === 'pj-1');
ok('PJ: 2 contas bancarias',       (empPJ.contas || []).length >= 2);

empPJ.lancamentos = [{
  id: 'l-pj-1', descricao: 'Venda teste', valor: 5000, tipo: 'receita',
  data: '2026-06-01', planoId: recPJ[0].id, contaId: empPJ.contas[0].id,
  status: 'pago', dataPagamento: '2026-06-01',
}];
await putState(tokenPJ, statePJ);
const s2PJ = await getState(tokenPJ);
const l2PJ = s2PJ?.empresas?.[0]?.lancamentos || [];
ok('PJ: lancamento salvo',   l2PJ.some(l => l.id === 'l-pj-1'));
ok('PJ: valor 5000 correto', l2PJ[0]?.valor === 5000);

// ─── Pessoa Física ───────────────────────────────────────────────────────────
console.log('\n── Pessoa Física ──');
const uidPF = await createUser(emailPF, 'Joao Fix', 'fisica');
const tokenPF = await login(emailPF);
ok('registro PF + login ok', !!tokenPF);

const statePF = await getState(tokenPF);
const empPF = statePF?.empresas?.[0];
const planoPF = empPF?.planoContas || [];

ok('empresa ativa PF', !!empPF);
ok('tipo fisica',      empPF?.tipo === 'fisica');
ok('planoContas = 18 categorias', planoPF.length === 18);
ok('PF: todas com icone', planoPF.every(c => c.icone));
ok('PF: todas com cor',   planoPF.every(c => c.cor));
ok('PF: tem Salario/Renda', planoPF.some(c => c.descricao?.includes('Salário') || c.descricao?.includes('Renda')));
ok('PF: Alimentacao',       planoPF.some(c => c.descricao === 'Alimentação'));
ok('PF: Moradia',           planoPF.some(c => c.descricao === 'Moradia'));
ok('PF: Saude',             planoPF.some(c => c.descricao === 'Saúde'));
ok('PF: Educacao',          planoPF.some(c => c.descricao === 'Educação'));
ok('PF: Transporte',        planoPF.some(c => c.descricao === 'Transporte'));
ok('PF: Assinaturas (nova)',       planoPF.some(c => c.descricao === 'Assinaturas'));
ok('PF: Academia/Esporte (nova)',  planoPF.some(c => c.descricao === 'Academia / Esporte'));
ok('PF: Pets (nova)',              planoPF.some(c => c.descricao === 'Pets'));
ok('PF: Viagens (nova)',           planoPF.some(c => c.descricao === 'Viagens'));
ok('PF: Presentes/Doacoes (nova)', planoPF.some(c => c.descricao === 'Presentes / Doações'));
ok('PF: Aluguel Recebido (nova)',  planoPF.some(c => c.descricao === 'Aluguel Recebido'));
ok('PF: Lazer/Entretenimento',     planoPF.some(c => c.descricao === 'Lazer / Entretenimento'));
ok('PF: onboarding nao concluido', empPF.onboardingConcluido === false);
ok('PF: etapa pf-1', empPF.onboardingEtapa === 'pf-1');
ok('PF: tem contas', (empPF.contas || []).length >= 1);

const catSal = planoPF.find(c => c.descricao?.includes('Salário') || c.descricao?.includes('Renda'));
empPF.lancamentos = [{
  id: 'l-pf-1', descricao: 'Salario junho', valor: 4500, tipo: 'receita',
  data: '2026-06-05', planoId: catSal?.id, contaId: empPF.contas[0].id,
  status: 'pago', dataPagamento: '2026-06-05',
}];
await putState(tokenPF, statePF);
const s2PF = await getState(tokenPF);
const l2PF = s2PF?.empresas?.[0]?.lancamentos || [];
ok('PF: lancamento salvo',   l2PF.some(l => l.id === 'l-pf-1'));
ok('PF: valor 4500 correto', l2PF[0]?.valor === 4500);

// ─── Migração automática: usuário existente com poucos cats ──────────────────
console.log('\n── Migração automática (servidor) ──');

// PJ: degrada 24 → 4, GET /state deve restaurar para 24
await query(
  `UPDATE estados SET dados = jsonb_set(dados, '{empresas,0,planoContas}', $1::jsonb) WHERE usuario_id = $2`,
  [JSON.stringify(planoPJ.slice(0, 4)), uidPJ]
);
const { rows: r1 } = await query(
  `SELECT jsonb_array_length(dados->'empresas'->0->'planoContas') as cats FROM estados WHERE usuario_id = $1`,
  [uidPJ]
);
ok('PJ: banco degradado para 4', r1[0]?.cats === 4);

const stateNormPJ = await getState(tokenPJ);
ok('PJ: GET /state retorna 24', (stateNormPJ?.empresas?.[0]?.planoContas || []).length === 24);

const { rows: r2 } = await query(
  `SELECT jsonb_array_length(dados->'empresas'->0->'planoContas') as cats FROM estados WHERE usuario_id = $1`,
  [uidPJ]
);
ok('PJ: banco atualizado para 24 automaticamente', r2[0]?.cats === 24);

// PF: degrada 18 → 12, GET /state deve restaurar para 18
await query(
  `UPDATE estados SET dados = jsonb_set(dados, '{empresas,0,planoContas}', $1::jsonb) WHERE usuario_id = $2`,
  [JSON.stringify(planoPF.slice(0, 12)), uidPF]
);
const { rows: r3 } = await query(
  `SELECT jsonb_array_length(dados->'empresas'->0->'planoContas') as cats FROM estados WHERE usuario_id = $1`,
  [uidPF]
);
ok('PF: banco degradado para 12', r3[0]?.cats === 12);

const stateNormPF = await getState(tokenPF);
ok('PF: GET /state retorna 18', (stateNormPF?.empresas?.[0]?.planoContas || []).length === 18);

const { rows: r4 } = await query(
  `SELECT jsonb_array_length(dados->'empresas'->0->'planoContas') as cats FROM estados WHERE usuario_id = $1`,
  [uidPF]
);
ok('PF: banco atualizado para 18 automaticamente', r4[0]?.cats === 18);

// ─── Limpeza + resultado ──────────────────────────────────────────────────────
await cleanup([emailPJ, emailPF]);
await pool.end();

console.log('\n' + '─'.repeat(52));
if (failed === 0) {
  console.log(`✅ Todos os ${passed} testes passaram!\n`);
} else {
  console.log(`❌ ${failed} falha(s) de ${passed + failed} testes\n`);
  process.exit(1);
}
