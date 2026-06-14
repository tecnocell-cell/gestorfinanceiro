/**
 * testMultiambienteIsolamento.js — FASE G Etapa 5
 *
 * Teste de isolamento multiambiente:
 * 1. Faz login com credenciais de teste
 * 2. Em ambiente PESSOAL: cria lançamento marcador TESTE_PESSOAL_111
 * 3. Salva via PUT /state
 * 4. Muda para ambiente EMPRESA
 * 5. GET /state e verifica que TESTE_PESSOAL_111 NÃO aparece na empresa
 * 6. Em ambiente EMPRESA: cria lançamento marcador TESTE_EMPRESA_222
 * 7. Muda para ambiente PESSOAL
 * 8. GET /state e verifica que TESTE_EMPRESA_222 NÃO aparece no pessoal
 *
 * Uso:
 *   node server/testMultiambienteIsolamento.js <email> <senha> [base_url]
 *
 * Exemplo:
 *   node server/testMultiambienteIsolamento.js giandersonfjs@gmail.com minha_senha http://localhost:3001
 */

import fetch from 'node-fetch';
import { randomUUID } from 'crypto';

const [,, EMAIL, SENHA, BASE = 'http://localhost:3001'] = process.argv;

if (!EMAIL || !SENHA) {
  console.error('Uso: node server/testMultiambienteIsolamento.js <email> <senha> [base_url]');
  process.exit(1);
}

let cookie = '';

async function req(path, opts = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...(opts.headers || {}),
    },
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { _raw: text }; }
  return { status: res.status, json };
}

function ok(label, cond, detail = '') {
  const sym = cond ? '✅' : '❌';
  console.log(`${sym} ${label}${detail ? ' — ' + detail : ''}`);
  return cond;
}

async function main() {
  console.log(`\n=== FASE G — Teste de Isolamento Multiambiente ===`);
  console.log(`Servidor: ${BASE}`);
  console.log(`Usuário: ${EMAIL}\n`);

  // ── 1. Login ────────────────────────────────────────────────────────────────
  const loginRes = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, senha: SENHA }),
  });
  if (!ok('Login', loginRes.status === 200, `status=${loginRes.status}`)) {
    console.error('Resposta:', loginRes.json);
    process.exit(1);
  }

  // ── 2. GET /state inicial ───────────────────────────────────────────────────
  const stateRes = await req('/api/state');
  if (!ok('GET /state inicial', stateRes.status === 200)) process.exit(1);

  const { dados, profile } = stateRes.json;
  const ambientes = dados.ambientes || [];
  console.log(`\nAmbientes (${ambientes.length}):`);
  ambientes.forEach((a) => console.log(`  ${a.tipo === 'pessoal' ? '🏠' : '🏢'} ${a.nome} [${a.id.slice(0,8)}]`));

  const ambPessoal = ambientes.find((a) => a.tipo === 'pessoal');
  const ambEmpresa = ambientes.find((a) => a.tipo === 'empresa');

  if (!ambPessoal) { console.error('\n❌ Sem ambiente pessoal. Crie primeiro.'); process.exit(1); }
  if (!ambEmpresa) { console.error('\n❌ Sem ambiente empresa. Crie primeiro.'); process.exit(1); }

  console.log(`\nPessoal: ${ambPessoal.nome} [${ambPessoal.id.slice(0,8)}]`);
  console.log(`Empresa: ${ambEmpresa.nome} [${ambEmpresa.id.slice(0,8)}]`);

  // ── 3. Muda para PESSOAL ────────────────────────────────────────────────────
  console.log('\n── Passo 1: Muda para ambiente PESSOAL ──');
  const selPessoal = await req(`/api/ambientes/${ambPessoal.id}/selecionar`, { method: 'POST' });
  ok('Selecionar pessoal', selPessoal.status === 200, `status=${selPessoal.status}`);

  const statePessoal1 = await req('/api/state');
  ok('GET state pessoal', statePessoal1.status === 200);
  const dadosPessoal1 = statePessoal1.json.dados;
  ok('ambienteAtualId = pessoal', dadosPessoal1.ambienteAtualId === ambPessoal.id,
    `got=${dadosPessoal1.ambienteAtualId?.slice(0,8)}`);

  // ── 4. Cria TESTE_PESSOAL_111 no pessoal ───────────────────────────────────
  console.log('\n── Passo 2: Cria TESTE_PESSOAL_111 no pessoal ──');
  const marcadorPessoal = {
    id: randomUUID(),
    codigo: 99901,
    lote: `TESTE-${Date.now()}`,
    data: new Date().toISOString().slice(0, 10),
    tipo: 'Saida',
    valor: 111,
    historico: 'TESTE_PESSOAL_111',
    descricao: 'TESTE_PESSOAL_111',
    planoId: '',
    natureza: 'Debito',
    pago: true,
    status: 'pago',
    exportado: false,
    createdAt: new Date().toISOString(),
    source: 'test',
  };

  const emp0Pessoal = (dadosPessoal1.empresas || [])[0];
  if (!emp0Pessoal) { console.error('❌ Sem empresa em pessoal'); process.exit(1); }
  const empComMarcador = {
    ...emp0Pessoal,
    lancamentos: [...(emp0Pessoal.lancamentos || []), marcadorPessoal],
  };
  const dadosParaSalvar = { ...dadosPessoal1, empresas: [empComMarcador] };

  const putPessoal = await req('/api/state', {
    method: 'PUT',
    body: JSON.stringify({ dados: dadosParaSalvar, ambienteAtualId: ambPessoal.id }),
  });
  ok('PUT state pessoal (com TESTE_PESSOAL_111)', putPessoal.status === 200,
    `status=${putPessoal.status}`);
  if (putPessoal.status !== 200) console.error('Erro PUT pessoal:', putPessoal.json);

  // Verifica que o marcador está de volta no GET
  const statePessoal2 = await req('/api/state');
  const dadosPessoal2 = statePessoal2.json.dados;
  const lancsP2 = dadosPessoal2.empresas?.[0]?.lancamentos || [];
  const temMarcadorNoPessoal = lancsP2.some((l) => l.historico === 'TESTE_PESSOAL_111');
  ok('TESTE_PESSOAL_111 visível no pessoal após PUT', temMarcadorNoPessoal,
    `total lancs=${lancsP2.length}`);

  // ── 5. Muda para EMPRESA e verifica isolamento ──────────────────────────────
  console.log('\n── Passo 3: Muda para ambiente EMPRESA e verifica isolamento ──');
  const selEmpresa = await req(`/api/ambientes/${ambEmpresa.id}/selecionar`, { method: 'POST' });
  ok('Selecionar empresa', selEmpresa.status === 200, `status=${selEmpresa.status}`);

  const stateEmpresa1 = await req('/api/state');
  ok('GET state empresa', stateEmpresa1.status === 200);
  const dadosEmpresa1 = stateEmpresa1.json.dados;
  ok('ambienteAtualId = empresa', dadosEmpresa1.ambienteAtualId === ambEmpresa.id,
    `got=${dadosEmpresa1.ambienteAtualId?.slice(0,8)}`);

  const lancsE1 = dadosEmpresa1.empresas?.[0]?.lancamentos || [];
  const contaminadoEmpresa = lancsE1.some((l) => l.historico === 'TESTE_PESSOAL_111');
  ok('TESTE_PESSOAL_111 NÃO aparece na empresa (isolamento OK)', !contaminadoEmpresa,
    `lancs empresa=${lancsE1.length}, contaminado=${contaminadoEmpresa}`);

  if (contaminadoEmpresa) {
    console.error('\n🔴 CONTAMINAÇÃO CONFIRMADA: lançamento pessoal visível em empresa!');
    console.error('IDs suspeitos:', lancsE1.filter((l) => l.historico === 'TESTE_PESSOAL_111').map((l) => l.id));
  }

  // ── 6. Cria TESTE_EMPRESA_222 na empresa ────────────────────────────────────
  console.log('\n── Passo 4: Cria TESTE_EMPRESA_222 na empresa ──');
  const marcadorEmpresa = {
    id: randomUUID(),
    codigo: 99902,
    lote: `TESTE-${Date.now()}`,
    data: new Date().toISOString().slice(0, 10),
    tipo: 'Entrada',
    valor: 222,
    historico: 'TESTE_EMPRESA_222',
    descricao: 'TESTE_EMPRESA_222',
    planoId: '',
    natureza: 'Credito',
    pago: true,
    status: 'pago',
    exportado: false,
    createdAt: new Date().toISOString(),
    source: 'test',
  };

  const emp0Empresa = (dadosEmpresa1.empresas || [])[0];
  if (!emp0Empresa) { console.error('❌ Sem empresa no ambiente empresa'); process.exit(1); }
  const empComMarcadorE = {
    ...emp0Empresa,
    lancamentos: [...(emp0Empresa.lancamentos || []).filter((l) => l.historico !== 'TESTE_PESSOAL_111'), marcadorEmpresa],
  };
  const dadosEmpresaParaSalvar = { ...dadosEmpresa1, empresas: [empComMarcadorE] };

  const putEmpresa = await req('/api/state', {
    method: 'PUT',
    body: JSON.stringify({ dados: dadosEmpresaParaSalvar, ambienteAtualId: ambEmpresa.id }),
  });
  ok('PUT state empresa (com TESTE_EMPRESA_222)', putEmpresa.status === 200,
    `status=${putEmpresa.status}`);
  if (putEmpresa.status !== 200) console.error('Erro PUT empresa:', putEmpresa.json);

  // ── 7. Volta para PESSOAL e verifica isolamento inverso ─────────────────────
  console.log('\n── Passo 5: Volta para PESSOAL e verifica isolamento inverso ──');
  const selPessoal2 = await req(`/api/ambientes/${ambPessoal.id}/selecionar`, { method: 'POST' });
  ok('Selecionar pessoal (volta)', selPessoal2.status === 200, `status=${selPessoal2.status}`);

  const statePessoal3 = await req('/api/state');
  const dadosPessoal3 = statePessoal3.json.dados;
  ok('ambienteAtualId = pessoal (volta)', dadosPessoal3.ambienteAtualId === ambPessoal.id,
    `got=${dadosPessoal3.ambienteAtualId?.slice(0,8)}`);

  const lancsP3 = dadosPessoal3.empresas?.[0]?.lancamentos || [];
  const contaminadoPessoal = lancsP3.some((l) => l.historico === 'TESTE_EMPRESA_222');
  const temMarcadorPessoalAinda = lancsP3.some((l) => l.historico === 'TESTE_PESSOAL_111');

  ok('TESTE_EMPRESA_222 NÃO aparece no pessoal (isolamento OK)', !contaminadoPessoal,
    `lancs pessoal=${lancsP3.length}, contaminado=${contaminadoPessoal}`);
  ok('TESTE_PESSOAL_111 ainda presente no pessoal', temMarcadorPessoalAinda,
    `lancs pessoal=${lancsP3.length}`);

  if (contaminadoPessoal) {
    console.error('\n🔴 CONTAMINAÇÃO INVERSA CONFIRMADA: lançamento empresa visível em pessoal!');
  }

  // ── 8. Limpeza: remove os lançamentos de teste ──────────────────────────────
  console.log('\n── Limpeza: remove marcadores de teste ──');
  // Pessoal: remove TESTE_PESSOAL_111
  const lancsP3Limpos = lancsP3.filter((l) => l.historico !== 'TESTE_PESSOAL_111');
  const emp0P3 = (dadosPessoal3.empresas || [])[0];
  if (emp0P3) {
    const dadosPessoalLimpo = {
      ...dadosPessoal3,
      empresas: [{ ...emp0P3, lancamentos: lancsP3Limpos }],
    };
    const putLimpezaP = await req('/api/state', {
      method: 'PUT',
      body: JSON.stringify({ dados: dadosPessoalLimpo, ambienteAtualId: ambPessoal.id }),
    });
    ok('Limpeza pessoal', putLimpezaP.status === 200);
  }

  // Empresa: remove TESTE_EMPRESA_222
  const selEm2 = await req(`/api/ambientes/${ambEmpresa.id}/selecionar`, { method: 'POST' });
  const stateEm2 = await req('/api/state');
  const dadosEm2 = stateEm2.json.dados;
  const lancsEm2 = dadosEm2.empresas?.[0]?.lancamentos || [];
  const lancsEm2Limpos = lancsEm2.filter((l) => l.historico !== 'TESTE_EMPRESA_222');
  const emp0Em2 = dadosEm2.empresas?.[0];
  if (emp0Em2) {
    const dadosEmpresaLimpo = {
      ...dadosEm2,
      empresas: [{ ...emp0Em2, lancamentos: lancsEm2Limpos }],
    };
    const putLimpezaE = await req('/api/state', {
      method: 'PUT',
      body: JSON.stringify({ dados: dadosEmpresaLimpo, ambienteAtualId: ambEmpresa.id }),
    });
    ok('Limpeza empresa', putLimpezaE.status === 200);
  }
  // Volta para pessoal ao final
  await req(`/api/ambientes/${ambPessoal.id}/selecionar`, { method: 'POST' });

  // ── Resultado Final ─────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════');
  const isolamentoOk = !contaminadoEmpresa && !contaminadoPessoal;
  if (isolamentoOk) {
    console.log('✅ ISOLAMENTO MULTIAMBIENTE OK — nenhuma contaminação detectada.');
  } else {
    console.log('❌ ISOLAMENTO FALHOU — contaminação de dados detectada.');
    if (contaminadoEmpresa)  console.log('   🔴 Pessoal → Empresa: CONTAMINADO');
    if (contaminadoPessoal) console.log('   🔴 Empresa → Pessoal: CONTAMINADO');
  }
  console.log('═══════════════════════════════════════════════\n');
  process.exit(isolamentoOk ? 0 : 1);
}

main().catch((err) => {
  console.error('Erro inesperado:', err);
  process.exit(1);
});
