/**
 * Testes Etapa 4.7 — Importação CSV/XLSX + rollback + OFX intacto
 * Uso: node server/test47.js
 * Requer servidor rodando: npm run server
 */
import { config } from 'dotenv';
config();

const BASE = `http://127.0.0.1:${process.env.PORT || 3001}/api`;
const LOGIN_EMAIL = process.env.TEST47_EMAIL || 'admin@gestor.local';
const LOGIN_PASS = process.env.TEST47_PASS || 'admin123';

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...opts.headers,
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`${path} → ${res.status}: ${data.error || res.statusText}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

const CSV_VALID = `data;historico;valor;tipo
01/06/2025;PIX recebido;150,50;Entrada
02/06/2025;Compra mercado;-45,90;Saida
03/06/2025;Transferencia;200,00;Entrada
`;

const CSV_REORDERED = `valor;historico;data
100,00;Teste ordem;10/05/2025
-50,00;Saida teste;11/05/2025
`;

const CSV_BR_DECIMAL = `data;descricao;valor
15/05/2025;Valor BR;1.234,56
16/05/2025;Negativo BR;-2.500,75
`;

const CSV_DUPLICATE = `data;historico;valor
20/05/2025;Duplicata teste;99,99
20/05/2025;Duplicata teste;99,99
`;

const MIN_OFX = `OFXHEADER:100
OFXSGML:102
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20250601120000
<TRNAMT>100.00
<FITID>test47-ofx-001
<MEMO>Teste OFX 4.7
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

async function getContaId(token) {
  const { dados } = await req('/state', { token });
  const emp = dados.empresas?.find((e) => e.id === dados.empresaAtivaId) || dados.empresas?.[0];
  const conta = emp?.contas?.find((c) => !c.inativo);
  assert(!!conta?.id, 'Conta bancária ativa encontrada');
  return conta.id;
}

async function main() {
  console.log('=== Testes Etapa 4.7 — CSV/XLSX ===\n');

  const login = await req('/auth/login', {
    method: 'POST',
    body: { email: LOGIN_EMAIL, senha: LOGIN_PASS },
  });
  const token = login.token;
  assert(!!token, `Login OK (${LOGIN_EMAIL})`);

  const contaId = await getContaId(token);
  const mapDefault = { data: 'data', historico: 'historico', valor: 'valor', tipo: 'tipo' };

  // 1. CSV válido — preview
  const prev1 = await req('/importacoes/csv-preview', {
    method: 'POST',
    token,
    body: { contaId, fileName: 'test.csv', fileContent: CSV_VALID, columnMap: mapDefault },
  });
  assert(prev1.total === 3, `CSV válido: ${prev1.total} transações`);
  assert(prev1.novas >= 1, 'CSV válido: ao menos 1 nova');

  // 2. CSV colunas fora de ordem
  const mapReorder = { data: 'data', historico: 'historico', valor: 'valor' };
  const prev2 = await req('/importacoes/csv-preview', {
    method: 'POST',
    token,
    body: { contaId, fileName: 'reorder.csv', fileContent: CSV_REORDERED, columnMap: mapReorder },
  });
  assert(prev2.total === 2, 'CSV reordenado: 2 transações');

  // 3. CSV vírgula decimal BR
  const mapBr = { data: 'data', historico: 'descricao', valor: 'valor' };
  const prev3 = await req('/importacoes/csv-preview', {
    method: 'POST',
    token,
    body: { contaId, fileName: 'br.csv', fileContent: CSV_BR_DECIMAL, columnMap: mapBr },
  });
  assert(prev3.total === 2, 'CSV decimal BR: 2 transações');
  const txBr = prev3.transacoes?.find((t) => t.historico?.includes('Valor BR'));
  assert(txBr && txBr.valor === 1234.56, 'CSV decimal BR: 1.234,56 → 1234.56');

  // 4. CSV duplicado no arquivo
  const prevDup = await req('/importacoes/csv-preview', {
    method: 'POST',
    token,
    body: {
      contaId,
      fileName: 'dup.csv',
      fileContent: CSV_DUPLICATE,
      columnMap: { data: 'data', historico: 'historico', valor: 'valor' },
    },
  });
  assert(prevDup.duplicadas >= 1, 'CSV duplicado: detecta duplicata no arquivo');

  // 5. Confirmar CSV
  const conf = await req('/importacoes/csv-confirmar', {
    method: 'POST',
    token,
    body: {
      contaId,
      fileName: 'test47.csv',
      fileContent: CSV_VALID,
      columnMap: mapDefault,
    },
  });
  assert(conf.importacaoId, 'CSV confirmar: retorna importacaoId');
  assert(conf.loteId?.startsWith('IMP-'), 'CSV confirmar: lote IMP-xxxx');

  // 6. CSV duplicado após import — preview deve marcar duplicadas
  const prevDupDb = await req('/importacoes/csv-preview', {
    method: 'POST',
    token,
    body: { contaId, fileName: 'test.csv', fileContent: CSV_VALID, columnMap: mapDefault },
  });
  assert(prevDupDb.duplicadas === 3, 'CSV reimport: todas duplicadas');

  // 7. Rollback CSV
  const rb = await req(`/importacoes/${conf.importacaoId}/rollback`, {
    method: 'POST',
    token,
  });
  assert(rb.ok === true, 'Rollback CSV: ok');
  assert(rb.removidos >= 1, `Rollback CSV: ${rb.removidos} removido(s)`);

  // 8. XLSX simples (gerado via base64 mínimo — usar CSV structure test via xlsx lib on server)
  // Criar XLSX em memória com xlsx package
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet([
    ['data', 'historico', 'valor'],
    ['2025-06-01', 'XLSX entrada', '75.25'],
    ['2025-06-02', 'XLSX saida', '-30.00'],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Extrato');
  const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const xlsxB64 = xlsxBuf.toString('base64');

  const prevX = await req('/importacoes/xlsx-preview', {
    method: 'POST',
    token,
    body: {
      contaId,
      fileName: 'test47.xlsx',
      fileContent: xlsxB64,
      columnMap: { data: 'data', historico: 'historico', valor: 'valor' },
    },
  });
  assert(prevX.total === 2, 'XLSX preview: 2 transações');

  const confX = await req('/importacoes/xlsx-confirmar', {
    method: 'POST',
    token,
    body: {
      contaId,
      fileName: 'test47.xlsx',
      fileContent: xlsxB64,
      columnMap: { data: 'data', historico: 'historico', valor: 'valor' },
    },
  });
  assert(confX.importados === 2, 'XLSX confirmar: 2 importados');

  const detX = await req(`/importacoes/${confX.importacaoId}`, { token });
  const lancX = detX.lancamentosImportados || [];
  assert(lancX.every((l) => l.source === 'xlsx'), 'XLSX: source=xlsx nos lançamentos');

  // 9. Rollback XLSX
  const rbX = await req(`/importacoes/${confX.importacaoId}/rollback`, {
    method: 'POST',
    token,
  });
  assert(rbX.removidos === 2, 'Rollback XLSX: 2 removidos');

  // 10. OFX continua funcionando
  const prevOfx = await req('/importacoes/ofx-preview', {
    method: 'POST',
    token,
    body: { contaId, fileName: 'test47.ofx', fileContent: MIN_OFX },
  });
  assert(prevOfx.total >= 1, 'OFX preview: ainda funciona');

  console.log('\n=== Todos os testes 4.7 passaram ===');
}

main().catch((err) => {
  console.error('\n✗', err.message);
  process.exit(1);
});
