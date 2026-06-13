/**
 * FASE 2 — Isolamento real dos ambientes financeiros: 11 testes obrigatórios
 *
 * 1.  Usuário antigo PF mantém dados no ambiente Pessoal (migração lazy)
 * 2.  Criar segundo ambiente Empresa via POST /api/ambientes
 * 3.  Novo ambiente começa vazio (lancamentos = [])
 * 4.  Criar lançamento na Empresa via PUT /api/state
 * 5.  Voltar para o ambiente Pessoal via POST /api/ambientes/:id/selecionar
 * 6.  Lançamento da Empresa NÃO aparece no Pessoal
 * 7.  Dashboard muda conforme ambiente (saldo diferente)
 * 8.  Clientes/fornecedores são separados por ambiente
 * 9.  WhatsApp sincroniza porAmbiente (unit test)
 * 10. PUT /api/state não apaga dados de outros ambientes
 * 11. buildEmptyAmbienteData e mergeAmbienteIntoStored corretos
 */
import { config } from 'dotenv';
config();

import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { query, pool } from './db.js';
import { runMigrations } from './migrate.js';
import {
  migrateToMultiambiente,
  rebuildEmpresasView,
  mergeAmbienteIntoStored,
  buildEmptyAmbienteData,
} from './ambientes/ambientesService.js';

const BASE = 'http://localhost:3001';
const TS   = Date.now();
const PASS = 'Teste123!';
let passed = 0, failed = 0;

function ok(label, val) {
  if (val) { console.log(`  ✓ ${label}`); passed++; }
  else      { console.error(`  ✗ ${label}`); failed++; }
}

// Retorna { status, data } onde data é o JSON completo da resposta
async function req(path, opts = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

// GET /api/state → retorna data.dados (objeto financeiro) + data.profile
async function getState(token) {
  const r = await req('/state', { token });
  return r.data; // { dados, profile }
}

// PUT /api/state — envia { dados } (objeto financeiro com empresas, ambienteAtualId etc)
async function putState(token, dados) {
  return req('/state', { method: 'PUT', token, body: { dados } });
}

async function createUserDirect(email, tipoPerfil = 'fisica', nomePerfil) {
  const hash = await bcrypt.hash(PASS, 10);
  const nome = nomePerfil || (tipoPerfil === 'fisica' ? 'Usuário PF Fase2' : 'Empresa PJ Fase2');
  const { rows } = await query(
    `INSERT INTO usuarios (email, senha_hash, nome, role, ativo, tipo_perfil, nome_perfil, email_verificado, telefone_verificado)
     VALUES ($1, $2, $3, 'user', true, $4, $5, true, false) RETURNING id`,
    [email, hash, nome, tipoPerfil, nome]
  );
  const userId = rows[0].id;

  await query(
    `INSERT INTO estados (usuario_id, dados) VALUES ($1, $2)`,
    [userId, JSON.stringify({
      empresas: [{
        id: 'e1', nome, tipo: tipoPerfil === 'fisica' ? 'fisica' : 'juridica',
        lancamentos: [{ id: 'lancamento-legado-1', tipo: 'Entrada', valor: 999, historico: 'Dado legado' }],
        contas: [{ id: 'conta-legada-1', nome: 'Carteira' }],
        clientes: [{ id: 'cli-legado-1', nome: 'Cliente Antigo' }],
        planoContas: [],
        fornecedores: [],
      }],
      empresaAtivaId: 'e1',
      filterPeriodo: { ano: new Date().getFullYear(), mes: null },
    })]
  );

  const { rows: planos } = await query(
    `SELECT id FROM planos WHERE slug = $1 LIMIT 1`,
    [tipoPerfil === 'fisica' ? 'pf_basico' : 'pj_basico']
  );
  if (planos.length) {
    const trialAte = new Date(); trialAte.setDate(trialAte.getDate() + 7);
    await query(
      `INSERT INTO assinaturas (usuario_id, plano_id, status, inicio_em, trial_ate)
       VALUES ($1, $2, 'trial', NOW(), $3) ON CONFLICT DO NOTHING`,
      [userId, planos[0].id, trialAte]
    );
  }
  return userId;
}

async function cleanupUser(email) {
  const { rows } = await query('SELECT id FROM usuarios WHERE email = $1', [email]);
  if (!rows.length) return;
  const id = rows[0].id;
  await query('DELETE FROM ambientes_financeiros WHERE usuario_id = $1', [id]);
  await query('DELETE FROM assinaturas WHERE usuario_id = $1', [id]);
  await query('DELETE FROM estados WHERE usuario_id = $1', [id]);
  await query('DELETE FROM usuarios WHERE id = $1', [id]);
}

async function login(email) {
  const { data } = await req('/auth/login', { method: 'POST', body: { email, senha: PASS } });
  return data.token || null;
}

// ────────────────────────────────────────────────────────────────────────────
// TESTE 1 — Migração lazy: usuário antigo PF mantém dados no ambiente Pessoal
// ────────────────────────────────────────────────────────────────────────────
async function teste1_migracao_lazy() {
  console.log('\n[1] Migração lazy — dados PF mantidos no ambiente Pessoal');

  // Unit test: migrateToMultiambiente
  const ambId = randomUUID();
  const empresa = {
    id: randomUUID(), nome: 'Dados Antigos', tipo: 'fisica',
    lancamentos: [{ id: 'l-orig', valor: 500, tipo: 'Entrada' }],
    contas: [{ id: 'c1', nome: 'Carteira' }],
    clientes: [{ id: 'cli1', nome: 'João' }],
  };
  const dadosAntigos = { empresas: [empresa], empresaAtivaId: empresa.id, ambienteAtualId: ambId };

  const migrado = migrateToMultiambiente(dadosAntigos, ambId);
  ok('porAmbiente criado', !!migrado.porAmbiente);
  ok('dados preservados em porAmbiente[ambId]', migrado.porAmbiente[ambId]?.id === empresa.id);
  ok('lancamentos preservados', migrado.porAmbiente[ambId]?.lancamentos?.length === 1);
  ok('contas preservadas', migrado.porAmbiente[ambId]?.contas?.length === 1);
  ok('migrateToMultiambiente é idempotente', migrateToMultiambiente(migrado, ambId) === migrado);

  const rebuilt = rebuildEmpresasView(migrado);
  ok('empresas[] reflete ambiente atual', rebuilt.empresas[0]?.id === empresa.id);

  // Teste via API: usuário com dados legados (sem porAmbiente)
  const emailOld = `f2_old_${TS}@test.local`;
  await cleanupUser(emailOld);
  await createUserDirect(emailOld, 'fisica', 'Usuário Antigo PF');
  const tokenOld = await login(emailOld);
  ok('login usuário antigo OK', !!tokenOld);
  if (tokenOld) {
    const { dados } = await getState(tokenOld);
    ok('GET /state retorna ambienteAtualId', !!dados?.ambienteAtualId);
    ok('GET /state retorna ambientes[]', Array.isArray(dados?.ambientes) && dados.ambientes.length >= 1);
    ok('empresas[] preservada', Array.isArray(dados?.empresas) && dados.empresas.length >= 1);
    ok('lançamento legado preservado', dados?.empresas?.[0]?.lancamentos?.some(l => l.id === 'lancamento-legado-1'));
  }
  await cleanupUser(emailOld);
}

// ────────────────────────────────────────────────────────────────────────────
// TESTE 2 — Criar segundo ambiente via POST /api/ambientes
// ────────────────────────────────────────────────────────────────────────────
async function teste2_criar_ambiente(token) {
  console.log('\n[2] Criar segundo ambiente Empresa');

  // Primeiro, GET /state para garantir que o ambiente principal seja criado
  const { dados: dadosInicial } = await getState(token);
  ok('estado inicial carregado', !!dadosInicial?.ambienteAtualId);

  const r = await req('/ambientes', { method: 'POST', token, body: { nome: 'Empresa Teste', tipo: 'empresa' } });
  ok('status 201', r.status === 201);
  ok('retorna ambiente.id', !!r.data.ambiente?.id);
  ok('nome correto', r.data.ambiente?.nome === 'Empresa Teste');
  ok('tipo correto', r.data.ambiente?.tipo === 'empresa');

  const lista = await req('/ambientes', { token });
  ok('lista retorna >= 2 ambientes', (lista.data.ambientes?.length ?? 0) >= 2);

  return r.data.ambiente;
}

// ────────────────────────────────────────────────────────────────────────────
// TESTE 3 — Novo ambiente começa vazio
// ────────────────────────────────────────────────────────────────────────────
async function teste3_ambiente_vazio(token, ambienteEmpresa) {
  console.log('\n[3] Novo ambiente começa vazio');

  const sel = await req(`/ambientes/${ambienteEmpresa.id}/selecionar`, { method: 'POST', token });
  ok('selecionar retorna ok', sel.data.ok === true);

  const { dados } = await getState(token);
  ok('ambienteAtualId é o novo', dados?.ambienteAtualId === ambienteEmpresa.id);

  const empresa = dados?.empresas?.[0];
  ok('empresa existe', !!empresa);
  ok('lancamentos vazios', (empresa?.lancamentos ?? []).length === 0);
  ok('clientes vazios', (empresa?.clientes ?? []).length === 0);
}

// ────────────────────────────────────────────────────────────────────────────
// TESTE 4 — Criar lançamento na Empresa via PUT /api/state
// ────────────────────────────────────────────────────────────────────────────
async function teste4_lancamento_empresa(token) {
  console.log('\n[4] Criar lançamento na Empresa');

  const { dados } = await getState(token);
  const empresa = dados?.empresas?.[0];
  if (!empresa) { ok('empresa disponível', false); return null; }

  const lancId = randomUUID();
  const lanc = {
    id: lancId, codigo: 1,
    lote: `${new Date().toISOString().slice(0, 10)}-1`,
    data: new Date().toISOString().slice(0, 10),
    tipo: 'Entrada', valor: 1000,
    historico: 'Receita Empresa Teste', planoId: '',
    natureza: 'Credito', pago: true, status: 'pago',
    exportado: false, consiliado: false,
    createdAt: new Date().toISOString(),
  };
  const empresaAtualizada = { ...empresa, lancamentos: [...(empresa.lancamentos || []), lanc] };
  const novosDados = { ...dados, empresas: [empresaAtualizada], empresaAtivaId: empresaAtualizada.id };

  const r = await putState(token, novosDados);
  ok('PUT retorna 200', r.status === 200);

  const { dados: dadosDepois } = await getState(token);
  const lances = dadosDepois?.empresas?.[0]?.lancamentos ?? [];
  ok('lançamento salvo na Empresa', lances.some(l => l.id === lancId));

  return lancId;
}

// ────────────────────────────────────────────────────────────────────────────
// TESTE 5 — Voltar para o ambiente Pessoal
// ────────────────────────────────────────────────────────────────────────────
async function teste5_volta_pessoal(token, ambienteEmpresaId) {
  console.log('\n[5] Voltar para o ambiente Pessoal');

  const { dados } = await getState(token);
  const ambientes = dados?.ambientes ?? [];
  const pessoal = ambientes.find(a => a.id !== ambienteEmpresaId);

  if (!pessoal) { ok('ambiente Pessoal existe', false); return null; }

  const sel = await req(`/ambientes/${pessoal.id}/selecionar`, { method: 'POST', token });
  ok('selecionou Pessoal com ok', sel.data.ok === true);

  const { dados: dadosDepois } = await getState(token);
  ok('ambienteAtualId é Pessoal', dadosDepois?.ambienteAtualId === pessoal.id);

  return pessoal.id;
}

// ────────────────────────────────────────────────────────────────────────────
// TESTE 6 — Lançamento da Empresa NÃO aparece no Pessoal
// ────────────────────────────────────────────────────────────────────────────
async function teste6_isolamento(token, lancamentoId) {
  console.log('\n[6] Lançamento da Empresa não aparece no Pessoal');

  const { dados } = await getState(token);
  const lances = dados?.empresas?.[0]?.lancamentos ?? [];
  ok('lançamento da Empresa ausente no Pessoal', !lances.some(l => l.id === lancamentoId));
  ok('lançamento legado PF ainda existe', lances.some(l => l.id === 'lancamento-legado-1'));
}

// ────────────────────────────────────────────────────────────────────────────
// TESTE 7 — Dashboard muda conforme ambiente
// ────────────────────────────────────────────────────────────────────────────
async function teste7_dashboard(token, ambienteEmpresaId, pessoalId) {
  console.log('\n[7] Dashboard muda conforme ambiente');

  const { dados: dadosPessoal } = await getState(token);
  const totalPessoal = (dadosPessoal?.empresas?.[0]?.lancamentos ?? [])
    .reduce((s, l) => s + (l.tipo === 'Entrada' ? l.valor : -l.valor), 0);

  await req(`/ambientes/${ambienteEmpresaId}/selecionar`, { method: 'POST', token });
  const { dados: dadosEmpresa } = await getState(token);
  const totalEmpresa = (dadosEmpresa?.empresas?.[0]?.lancamentos ?? [])
    .reduce((s, l) => s + (l.tipo === 'Entrada' ? l.valor : -l.valor), 0);

  ok('saldo Pessoal diferente do Empresa', totalPessoal !== totalEmpresa);
  ok('Empresa tem saldo R$1000', totalEmpresa === 1000);
  ok('Pessoal tem saldo legado R$999', totalPessoal === 999);

  // Volta para Pessoal
  if (pessoalId) await req(`/ambientes/${pessoalId}/selecionar`, { method: 'POST', token });
}

// ────────────────────────────────────────────────────────────────────────────
// TESTE 8 — Clientes/fornecedores separados por ambiente (unit test)
// ────────────────────────────────────────────────────────────────────────────
async function teste8_clientes_separados() {
  console.log('\n[8] Clientes/fornecedores separados (unit test)');

  const ambA = randomUUID();
  const ambB = randomUUID();
  const empA = { id: 'emp-a', clientes: [{ id: 'cli-a', nome: 'Cliente A' }], fornecedores: [{ id: 'for-a' }], lancamentos: [] };
  const empB = { id: 'emp-b', clientes: [{ id: 'cli-b', nome: 'Cliente B' }], fornecedores: [], lancamentos: [] };

  const stored = { porAmbiente: { [ambA]: empA, [ambB]: empB }, ambienteAtualId: ambA, empresas: [empA] };

  const viewA = rebuildEmpresasView({ ...stored, ambienteAtualId: ambA });
  const viewB = rebuildEmpresasView({ ...stored, ambienteAtualId: ambB });

  ok('clientes ambA corretos', viewA.empresas[0].clientes[0].id === 'cli-a');
  ok('clientes ambB corretos', viewB.empresas[0].clientes[0].id === 'cli-b');
  ok('ambA não vê clienteB', !viewA.empresas[0].clientes.some(c => c.id === 'cli-b'));
  ok('ambB não vê clienteA', !viewB.empresas[0].clientes.some(c => c.id === 'cli-a'));
  ok('fornecedores separados', viewA.empresas[0].fornecedores.length === 1 && viewB.empresas[0].fornecedores.length === 0);
}

// ────────────────────────────────────────────────────────────────────────────
// TESTE 9 — WhatsApp lança no ambiente atual (unit test)
// ────────────────────────────────────────────────────────────────────────────
async function teste9_whatsapp() {
  console.log('\n[9] WhatsApp sincroniza porAmbiente (unit test)');

  const ambId = randomUUID();
  const ambB  = randomUUID();
  const empId = randomUUID();
  const stored = {
    porAmbiente: {
      [ambId]: { id: empId, lancamentos: [] },
      [ambB]:  { id: 'empB', lancamentos: [{ id: 'l-b' }] },
    },
    ambienteAtualId: ambId,
    empresas: [{ id: empId, lancamentos: [] }],
    empresaAtivaId: empId,
  };

  // Simula o que confirmPendingLancamento faz (financePending.js)
  const lancNovo = { id: randomUUID(), tipo: 'Entrada', valor: 200 };
  const updatedEmpresa = { ...stored.porAmbiente[ambId], lancamentos: [lancNovo] };
  const novasEmpresas = [updatedEmpresa];
  const updatedPorAmbiente = stored.porAmbiente && ambId
    ? { ...stored.porAmbiente, [ambId]: updatedEmpresa }
    : stored.porAmbiente;
  const novoEstado = { ...stored, empresas: novasEmpresas, porAmbiente: updatedPorAmbiente };

  ok('porAmbiente ambId atualizado', novoEstado.porAmbiente[ambId].lancamentos.length === 1);
  ok('outro ambiente preservado (ambB)', novoEstado.porAmbiente[ambB].lancamentos.length === 1);
  ok('empresas[] sincronizada', novoEstado.empresas[0].lancamentos.length === 1);
  ok('lançamento correto', novoEstado.porAmbiente[ambId].lancamentos[0].id === lancNovo.id);

  // mergeAmbienteIntoStored
  const merged = mergeAmbienteIntoStored(stored, updatedEmpresa, ambId, null);
  ok('merge: ambB preservado', merged.porAmbiente[ambB].lancamentos.length === 1);
  ok('merge: ambId atualizado', merged.porAmbiente[ambId].lancamentos.length === 1);
}

// ────────────────────────────────────────────────────────────────────────────
// TESTE 10 — PUT /api/state não apaga dados de outros ambientes
// ────────────────────────────────────────────────────────────────────────────
async function teste10_put_preserva_outros(token, ambienteEmpresaId, pessoalId) {
  console.log('\n[10] PUT não apaga dados de outros ambientes');

  // Vai para Empresa (tem lançamento do teste 4)
  await req(`/ambientes/${ambienteEmpresaId}/selecionar`, { method: 'POST', token });
  const { dados: dadosEmpresa } = await getState(token);
  const lancamentosEmpresa = dadosEmpresa?.empresas?.[0]?.lancamentos ?? [];
  ok('Empresa tem lançamentos antes do PUT', lancamentosEmpresa.length > 0);

  // Vai para Pessoal e faz PUT com novo lançamento no Pessoal
  await req(`/ambientes/${pessoalId}/selecionar`, { method: 'POST', token });
  const { dados: dadosPessoal } = await getState(token);
  const empresaPessoal = dadosPessoal?.empresas?.[0];

  const lancPessoalId = randomUUID();
  const lancPessoal = {
    id: lancPessoalId, codigo: 99, lote: `${new Date().toISOString().slice(0, 10)}-99`,
    data: new Date().toISOString().slice(0, 10), tipo: 'Saida', valor: 50,
    historico: 'Despesa Pessoal PUT test', natureza: 'Debito',
    pago: true, status: 'pago', exportado: false, consiliado: false,
    createdAt: new Date().toISOString(),
  };
  const empPessoalAtualizada = {
    ...empresaPessoal,
    lancamentos: [...(empresaPessoal?.lancamentos ?? []), lancPessoal],
  };
  const r = await putState(token, { ...dadosPessoal, empresas: [empPessoalAtualizada] });
  ok('PUT Pessoal retorna 200', r.status === 200);

  // Volta para Empresa: lançamentos dela devem persistir
  await req(`/ambientes/${ambienteEmpresaId}/selecionar`, { method: 'POST', token });
  const { dados: dadosEmpresaDepois } = await getState(token);
  const lancEmpresaDepois = dadosEmpresaDepois?.empresas?.[0]?.lancamentos ?? [];
  ok('lançamentos da Empresa preservados após PUT no Pessoal', lancEmpresaDepois.length === lancamentosEmpresa.length);

  // Pessoal deve ter o novo lançamento
  await req(`/ambientes/${pessoalId}/selecionar`, { method: 'POST', token });
  const { dados: dadosPessoalDepois } = await getState(token);
  const lancPessoalDepois = dadosPessoalDepois?.empresas?.[0]?.lancamentos ?? [];
  ok('lançamento Pessoal salvo', lancPessoalDepois.some(l => l.id === lancPessoalId));
}

// ────────────────────────────────────────────────────────────────────────────
// TESTE 11 — buildEmptyAmbienteData e mergeAmbienteIntoStored
// ────────────────────────────────────────────────────────────────────────────
async function teste11_helpers() {
  console.log('\n[11] buildEmptyAmbienteData e mergeAmbienteIntoStored');

  const emptyPF = buildEmptyAmbienteData('pessoal', 'Meu Pessoal');
  const emptyPJ = buildEmptyAmbienteData('empresa', 'Minha Empresa');

  ok('emptyPF tem id', !!emptyPF?.id);
  ok('emptyPF lancamentos vazio', Array.isArray(emptyPF?.lancamentos) && emptyPF.lancamentos.length === 0);
  ok('emptyPJ tem id', !!emptyPJ?.id);
  ok('emptyPJ lancamentos vazio', Array.isArray(emptyPJ?.lancamentos) && emptyPJ.lancamentos.length === 0);

  const ambA = randomUUID();
  const ambB = randomUUID();
  const stored = {
    porAmbiente: {
      [ambA]: { id: 'empA', lancamentos: [{ id: 'l1' }] },
      [ambB]: { id: 'empB', lancamentos: [] },
    },
    ambienteAtualId: ambA,
    empresas: [{ id: 'empA', lancamentos: [{ id: 'l1' }] }],
  };
  const empresaNovaB = { id: 'empB', lancamentos: [{ id: 'l2' }] };
  const merged = mergeAmbienteIntoStored(stored, empresaNovaB, ambB, null);

  ok('ambA preservado', merged.porAmbiente[ambA].lancamentos.length === 1);
  ok('ambB atualizado', merged.porAmbiente[ambB].lancamentos[0].id === 'l2');
  ok('empresas[] = ambB', merged.empresas[0].lancamentos[0].id === 'l2');
  ok('ambienteAtualId = ambB', merged.ambienteAtualId === ambB);
}

// ────────────────────────────────────────────────────────────────────────────
// TESTE 12 — Normalização por tipo de ambiente (PF cria Empresa → estrutura PJ)
// ────────────────────────────────────────────────────────────────────────────
async function teste12_normalizacao_por_ambiente(token, ambienteEmpresaId, pessoalId) {
  console.log('\n[12] Normalização por tipo de ambiente');

  // Pessoal: deve ter estrutura PF (planoContas PF, pessoa, sem company)
  await req(`/ambientes/${pessoalId}/selecionar`, { method: 'POST', token });
  const { dados: dadosPF } = await getState(token);
  const empPF = dadosPF?.empresas?.[0];
  ok('Pessoal tem tipo fisica (ou sem tipo PJ)', empPF?.tipo !== 'juridica');
  ok('Pessoal tem planoContas PF (>0 categorias)', (empPF?.planoContas?.length ?? 0) > 0);
  const temCatPF = (empPF?.planoContas ?? []).some(c =>
    /moradia|alimenta|saúde|transporte|lazer|salário|renda/i.test(c.descricao || c.nome || '')
  );
  ok('Pessoal tem categorias PF (moradia/alimentação/etc)', temCatPF);

  // Empresa: deve ter estrutura PJ (planoContas PJ, company)
  await req(`/ambientes/${ambienteEmpresaId}/selecionar`, { method: 'POST', token });
  const { dados: dadosPJ } = await getState(token);
  const empPJ = dadosPJ?.empresas?.[0];
  ok('Empresa tem planoContas PJ (>0 categorias)', (empPJ?.planoContas?.length ?? 0) > 0);
  const temCatPJ = (empPJ?.planoContas ?? []).some(c =>
    /receita|despesa|custo|vendas|salário|folha|impostos|serviço/i.test(c.descricao || c.nome || '')
  );
  ok('Empresa tem categorias PJ (receita/despesa/custo)', temCatPJ);
  ok('Empresa tem company ou nome', !!(empPJ?.company || empPJ?.nome));

  // Categorias PF e PJ não são iguais (não misturou)
  const catPFIds = new Set((empPF?.planoContas ?? []).map(c => c.id));
  const catPJIds = new Set((empPJ?.planoContas ?? []).map(c => c.id));
  const intersecao = [...catPFIds].filter(id => catPJIds.has(id));
  ok('Planos de contas PF e PJ são independentes', intersecao.length === 0);

  // Volta para Pessoal
  await req(`/ambientes/${pessoalId}/selecionar`, { method: 'POST', token });
}

// ────────────────────────────────────────────────────────────────────────────
// Runner
// ────────────────────────────────────────────────────────────────────────────
await runMigrations();

const emailPF = `f2_pf_${TS}@test.local`;
await cleanupUser(emailPF);
await createUserDirect(emailPF, 'fisica', 'Usuário PF Fase2');
const token = await login(emailPF);

if (!token) {
  console.error('Falha ao obter token do usuário de teste');
  await pool.end();
  process.exit(1);
}

console.log('=== FASE 2 — Isolamento real dos ambientes financeiros ===');

await teste1_migracao_lazy();

const ambienteEmpresa = await teste2_criar_ambiente(token);
let pessoalId = null;

if (ambienteEmpresa) {
  await teste3_ambiente_vazio(token, ambienteEmpresa);
  const lancamentoId = await teste4_lancamento_empresa(token);
  pessoalId = await teste5_volta_pessoal(token, ambienteEmpresa.id);
  if (lancamentoId) await teste6_isolamento(token, lancamentoId);
  if (pessoalId) await teste7_dashboard(token, ambienteEmpresa.id, pessoalId);
}

await teste8_clientes_separados();
await teste9_whatsapp();

if (ambienteEmpresa && pessoalId) {
  await teste10_put_preserva_outros(token, ambienteEmpresa.id, pessoalId);
}

await teste11_helpers();

if (ambienteEmpresa && pessoalId) {
  await teste12_normalizacao_por_ambiente(token, ambienteEmpresa.id, pessoalId);
}

await cleanupUser(emailPF);

console.log(`\n${'='.repeat(50)}`);
console.log(`Resultado: ${passed} passaram, ${failed} falharam`);
if (failed > 0) { console.error('\n❌ Testes com falha!'); await pool.end(); process.exit(1); }
else { console.log('\n✅ Todos os testes passaram!'); }
await pool.end();
