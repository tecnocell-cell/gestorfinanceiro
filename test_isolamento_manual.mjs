const BASE = 'http://localhost:3001';

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const r = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  try { return { status: r.status, data: JSON.parse(text) }; }
  catch { return { status: r.status, data: text }; }
}

function saldoTotal(dados) {
  const contas = dados?.empresas?.[0]?.contas ?? [];
  return Math.round(contas.reduce((s, c) => s + (c.saldo ?? 0), 0) * 100) / 100;
}

function countLancamentos(dados) {
  return (dados?.empresas?.[0]?.lancamentos ?? []).length;
}

let PASS = 0, FAIL = 0;
function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`  ${ok ? '✅' : '❌'} ${label}: ${JSON.stringify(got)} (esperado: ${JSON.stringify(expected)})`);
  if (ok) PASS++; else FAIL++;
}

async function main() {
  // ── STEP 1: LOGIN ──────────────────────────────────────────────
  console.log('\n=== STEP 1: LOGIN ===');
  const login = await api('POST', '/api/auth/login', { email: 'teste_fase2@fluxiva.test', senha: 'Teste@123' });
  if (login.status !== 200) { console.error('Login falhou:', JSON.stringify(login)); process.exit(1); }
  const token = login.data.token;
  console.log('✓ Login OK | User:', login.data.user?.nome, '| tipo_perfil:', login.data.user?.tipo_perfil);

  // ── STEP 2: GET /state — ambiente pessoal ──────────────────────
  console.log('\n=== STEP 2: GET /state inicial ===');
  const s0 = await api('GET', '/api/state', null, token);
  const ambPessoalId = s0.data.dados.ambienteAtualId;
  let dados = s0.data.dados;
  console.log('ambientes:', JSON.stringify(dados.ambientes?.map(a => ({ nome: a.nome, tipo: a.tipo }))));
  console.log('ambienteAtualId:', ambPessoalId?.slice(0, 8), '(pessoal)');

  // ── STEP 2b: Criar lançamento R$ 111,11 em Pessoal ─────────────
  console.log('\n=== STEP 2b: Lançar R$ 111,11 em Pessoal ===');
  const now = new Date().toISOString().split('T')[0];
  const contaPF = dados.empresas?.[0]?.contas?.[0];
  const catPF = dados.empresas?.[0]?.planoContas?.find(c =>
    c.natureza === 'receita' || c.tipo === 'receita' || c.classificacao === 'receita'
  );
  console.log('  conta PF:', contaPF?.nome, '| cat receita:', catPF?.nome ?? '(sem categoria)');

  const lanc111 = {
    id: 'lanc-pf-111-test',
    tipo: 'receita',
    descricao: 'Receita PF 111,11',
    valor: 111.11,
    data: now,
    contaId: contaPF?.id,
    categoriaId: catPF?.id,
    conciliado: false,
    recorrente: false,
  };
  const empPFv1 = { ...dados.empresas[0] };
  empPFv1.lancamentos = [...(empPFv1.lancamentos ?? []), lanc111];
  if (contaPF) {
    empPFv1.contas = (empPFv1.contas ?? []).map(c =>
      c.id === contaPF.id ? { ...c, saldo: Math.round(((c.saldo ?? 0) + 111.11) * 100) / 100 } : c
    );
  }
  dados = { ...dados, empresas: [empPFv1] };
  const putPF = await api('PUT', '/api/state', { dados }, token);
  console.log('  PUT status:', putPF.status);

  // Verificar via GET
  const s2 = await api('GET', '/api/state', null, token);
  dados = s2.data.dados;
  check('Saldo PF = 111.11', saldoTotal(dados), 111.11);
  check('Lançamentos PF = 1', countLancamentos(dados), 1);
  check('normalização não ignorada (planoContas > 0)', (dados.empresas?.[0]?.planoContas?.length ?? 0) > 0, true);

  // ── STEP 3: Criar ambiente Empresa Teste ────────────────────────
  console.log('\n=== STEP 3: Criar ambiente "Empresa Teste" ===');
  const criarAmb = await api('POST', '/api/ambientes', { nome: 'Empresa Teste', tipo: 'empresa' }, token);
  console.log('  status:', criarAmb.status, '| response:', JSON.stringify(criarAmb.data).slice(0, 120));
  const ambEmpresaId = criarAmb.data?.ambiente?.id;
  if (!ambEmpresaId) { console.error('ERRO: id do ambiente não encontrado na resposta'); process.exit(1); }
  console.log('  ambEmpresaId:', ambEmpresaId.slice(0, 8));
  check('Criar ambiente status 201', criarAmb.status, 201);

  // ── STEP 4: Selecionar Empresa + verificar zerado ───────────────
  console.log('\n=== STEP 4: Selecionar "Empresa Teste" ===');
  const sel1 = await api('POST', `/api/ambientes/${ambEmpresaId}/selecionar`, null, token);
  console.log('  selecionar status:', sel1.status, '| ambienteAtualId retornado:', sel1.data?.ambienteAtualId?.slice(0, 8));
  check('Selecionar empresa status 200', sel1.status, 200);

  const s3 = await api('GET', '/api/state', null, token);
  dados = s3.data.dados;
  const contaPJ = dados.empresas?.[0]?.contas?.[0];
  const catPJ = dados.empresas?.[0]?.planoContas?.find(c =>
    c.natureza === 'receita' || c.tipo === 'receita' || c.classificacao === 'receita'
  );
  check('ambienteAtualId = empresa', dados.ambienteAtualId, ambEmpresaId);
  check('Saldo empresa zerado = 0', saldoTotal(dados), 0);
  check('Lançamentos empresa zerado = 0', countLancamentos(dados), 0);
  const temContam111 = (dados.empresas?.[0]?.lancamentos ?? []).some(l => l.valor === 111.11);
  check('Sem contaminação PF→Empresa', temContam111, false);
  check('planoContas empresa existe', (dados.empresas?.[0]?.planoContas?.length ?? 0) > 0, true);
  console.log('  planoContas empresa (3 primeiros):', dados.empresas?.[0]?.planoContas?.slice(0, 3).map(c => c.nome).join(', '));
  console.log('  conta PJ:', contaPJ?.nome);

  // ── STEP 5: Lançar R$ 222,22 em Empresa ────────────────────────
  console.log('\n=== STEP 5: Lançar R$ 222,22 em Empresa Teste ===');
  const lanc222 = {
    id: 'lanc-pj-222-test',
    tipo: 'receita',
    descricao: 'Receita PJ 222,22',
    valor: 222.22,
    data: now,
    contaId: contaPJ?.id,
    categoriaId: catPJ?.id,
    conciliado: false,
    recorrente: false,
  };
  const empPJv1 = { ...dados.empresas[0] };
  empPJv1.lancamentos = [...(empPJv1.lancamentos ?? []), lanc222];
  if (contaPJ) {
    empPJv1.contas = (empPJv1.contas ?? []).map(c =>
      c.id === contaPJ.id ? { ...c, saldo: Math.round(((c.saldo ?? 0) + 222.22) * 100) / 100 } : c
    );
  }
  dados = { ...dados, empresas: [empPJv1] };
  const putPJ = await api('PUT', '/api/state', { dados }, token);
  console.log('  PUT status:', putPJ.status);

  const s4 = await api('GET', '/api/state', null, token);
  dados = s4.data.dados;
  check('Saldo empresa = 222.22', saldoTotal(dados), 222.22);
  check('Lançamentos empresa = 1', countLancamentos(dados), 1);

  // ── STEP 6: Voltar Pessoal — isolamento ────────────────────────
  console.log('\n=== STEP 6: Voltar para Pessoal — verificar isolamento ===');
  const sel2 = await api('POST', `/api/ambientes/${ambPessoalId}/selecionar`, null, token);
  console.log('  selecionar pessoal status:', sel2.status);

  const s5 = await api('GET', '/api/state', null, token);
  dados = s5.data.dados;
  check('ambienteAtualId = pessoal', dados.ambienteAtualId, ambPessoalId);
  check('Saldo PF ainda 111.11', saldoTotal(dados), 111.11);
  check('Lançamentos PF ainda 1', countLancamentos(dados), 1);
  const tem222noPF = (dados.empresas?.[0]?.lancamentos ?? []).some(l => l.valor === 222.22);
  check('Sem 222.22 no PF (isolamento OK)', tem222noPF, false);

  // ── STEP 7: Voltar Empresa — isolamento ────────────────────────
  console.log('\n=== STEP 7: Voltar para Empresa — verificar isolamento ===');
  const sel3 = await api('POST', `/api/ambientes/${ambEmpresaId}/selecionar`, null, token);
  console.log('  selecionar empresa status:', sel3.status);

  const s6 = await api('GET', '/api/state', null, token);
  dados = s6.data.dados;
  check('ambienteAtualId = empresa', dados.ambienteAtualId, ambEmpresaId);
  check('Saldo empresa ainda 222.22', saldoTotal(dados), 222.22);
  check('Lançamentos empresa ainda 1', countLancamentos(dados), 1);
  const tem111noPJ = (dados.empresas?.[0]?.lancamentos ?? []).some(l => l.valor === 111.11);
  check('Sem 111.11 na empresa (isolamento OK)', tem111noPJ, false);

  // ── STEP 8: 5 trocas consecutivas ──────────────────────────────
  console.log('\n=== STEP 8: 5 trocas consecutivas ===');
  const sequencia = [ambPessoalId, ambEmpresaId, ambPessoalId, ambEmpresaId, ambPessoalId];
  const nomes    = ['Pessoal', 'Empresa', 'Pessoal', 'Empresa', 'Pessoal'];
  const esperado = [111.11, 222.22, 111.11, 222.22, 111.11];
  for (let i = 0; i < sequencia.length; i++) {
    const r = await api('POST', `/api/ambientes/${sequencia[i]}/selecionar`, null, token);
    const sg = await api('GET', '/api/state', null, token);
    const d = sg.data.dados;
    const correto = d.ambienteAtualId === sequencia[i];
    const saldo = saldoTotal(d);
    const ok = correto && saldo === esperado[i];
    console.log(`  ${ok ? '✅' : '❌'} Troca ${i + 1} → ${nomes[i]}: http=${r.status} | amb=${correto ? 'ok' : 'ERRADO'} | saldo=${saldo} (esp ${esperado[i]})`);
    if (ok) PASS++; else FAIL++;
  }

  // ── STEP 9: RESUMO FINAL ────────────────────────────────────────
  console.log('\n=== STEP 9: RESUMO ESTADO FINAL ===');
  // Estado PF
  await api('POST', `/api/ambientes/${ambPessoalId}/selecionar`, null, token);
  const spf = await api('GET', '/api/state', null, token);
  const dpf = spf.data.dados;
  console.log('  [Pessoal]');
  console.log('    Lançamentos:', countLancamentos(dpf));
  console.log('    Saldo:', saldoTotal(dpf));
  console.log('    planoContas entries:', dpf.empresas?.[0]?.planoContas?.length ?? 0);

  // Estado Empresa
  await api('POST', `/api/ambientes/${ambEmpresaId}/selecionar`, null, token);
  const spj = await api('GET', '/api/state', null, token);
  const dpj = spj.data.dados;
  console.log('  [Empresa Teste]');
  console.log('    Lançamentos:', countLancamentos(dpj));
  console.log('    Saldo:', saldoTotal(dpj));
  console.log('    planoContas entries:', dpj.empresas?.[0]?.planoContas?.length ?? 0);

  // ── RESULTADO ──────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════');
  console.log(`✅ PASSOU: ${PASS} | ❌ FALHOU: ${FAIL}`);
  if (FAIL === 0) {
    console.log('🎉 TODOS OS TESTES PASSARAM — isolamento multiambiente OK');
    console.log('   ✓ Pronto para push');
  } else {
    console.log('🚨 FALHAS — NÃO fazer push');
  }
}

main().catch(e => { console.error('ERRO FATAL:', e); process.exit(1); });
