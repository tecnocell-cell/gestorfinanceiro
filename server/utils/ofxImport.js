/**
 * ofxImport — lógica compartilhada entre preview e confirmação OFX (Etapa 4.6B)
 */

import { randomUUID } from 'crypto';
import { parseOfxFile } from './parseOfx.js';
import { gerarFingerprint } from './fingerprint.js';

export function classificarTransacoes(usuarioId, txs, existingSet) {
  const seenInFile = new Set();
  const transacoes = [];
  let novas = 0;
  let duplicadas = 0;

  for (const tx of txs) {
    const fp = gerarFingerprint(usuarioId, tx);
    let status = 'nova';

    if (existingSet.has(fp) || seenInFile.has(fp)) {
      status = 'duplicada';
      duplicadas += 1;
    } else {
      novas += 1;
      seenInFile.add(fp);
    }

    transacoes.push({
      data: tx.data,
      valor: tx.valor,
      tipo: tx.tipo,
      historico: tx.historico,
      fitid: tx.fitid || null,
      status,
      fingerprint: fp,
      _raw: tx,
    });
  }

  return { transacoes, novas, duplicadas };
}

export async function loadExistingFingerprints(dbQuery, usuarioId, fingerprints) {
  const uniqueFps = [...new Set(fingerprints)];
  if (!uniqueFps.length) return new Set();

  const { rows } = await dbQuery(
    `SELECT fingerprint FROM importacoes_fingerprints
     WHERE usuario_id = $1 AND fingerprint = ANY($2)`,
    [usuarioId, uniqueFps]
  );
  return new Set(rows.map((r) => r.fingerprint));
}

export function parseOfxForImport(fileContent) {
  if (!fileContent || typeof fileContent !== 'string') {
    const err = new Error('Campo fileContent obrigatório.');
    err.status = 400;
    throw err;
  }

  let parsed;
  try {
    parsed = parseOfxFile(fileContent);
  } catch (err) {
    const e = new Error('Não foi possível interpretar o arquivo. Verifique se é um OFX ou QIF válido.');
    e.status = 422;
    throw e;
  }

  if (!parsed.txs.length) {
    const e = new Error('Nenhuma transação encontrada no arquivo.');
    e.status = 422;
    throw e;
  }

  return parsed;
}

function nextCodigo(lancamentos) {
  const nums = (lancamentos || [])
    .map((l) => Number(l.codigo))
    .filter((n) => Number.isFinite(n) && n > 0);
  return nums.length ? Math.max(...nums) + 1 : 1;
}

function resolveEmpresaAtiva(dados) {
  const empresas = Array.isArray(dados?.empresas) ? dados.empresas : [];
  if (!empresas.length) {
    const err = new Error('Estado do usuário sem empresa/perfil.');
    err.status = 422;
    throw err;
  }

  const activeId = dados.empresaAtivaId;
  let idx = activeId ? empresas.findIndex((e) => e.id === activeId) : -1;
  if (idx < 0) idx = 0;

  return { empresas, idx, empresa: empresas[idx] };
}

function validateConta(empresa, contaId) {
  if (!contaId || typeof contaId !== 'string') {
    const err = new Error('Campo contaId obrigatório.');
    err.status = 400;
    throw err;
  }

  const contas = Array.isArray(empresa.contas) ? empresa.contas : [];
  const conta = contas.find((c) => c.id === contaId && !c.inativo);
  if (!conta) {
    const err = new Error('Conta bancária inválida ou inativa.');
    err.status = 400;
    throw err;
  }
  return conta;
}

function validatePlano(empresa, planoId) {
  if (!planoId) return null;

  const planoContas = Array.isArray(empresa.planoContas) ? empresa.planoContas : [];
  const plano = planoContas.find((p) => p.id === planoId && !p.inativo);
  if (!plano) {
    const err = new Error('Categoria/plano inválido ou inativo.');
    err.status = 400;
    throw err;
  }
  return plano;
}

function buildLancamento(tx, { conta, contaId, planoId, loteId, codigo }) {
  const isEntrada = tx.tipo === 'Entrada';
  return {
    id: randomUUID(),
    codigo,
    data: tx.data,
    tipo: tx.tipo,
    valor: Math.abs(Number(tx.valor)),
    historico: String(tx.historico || '').trim() || 'Importação OFX',
    descricao: String(tx.historico || '').trim() || 'Importação OFX',
    planoId: planoId || '',
    contaEntradaId: isEntrada ? contaId : null,
    contaSaidaId: !isEntrada ? contaId : null,
    codigoDestino: isEntrada ? (conta.codigo ?? null) : null,
    codigoOrigem: !isEntrada ? (conta.codigo ?? null) : null,
    pago: true,
    lote: loteId,
    tipoOrigem: '',
    tipoDestino: '',
    natureza: isEntrada ? 'Credito' : 'Debito',
    consiliado: false,
    exportado: false,
    clienteId: null,
    fornecedorId: null,
    createdAt: new Date().toISOString(),
    source: 'ofx',
  };
}

function resolveImportStatus(importados, duplicatas, erros) {
  if (erros > 0 && importados === 0) return 'erro';
  if (erros > 0 || (importados === 0 && duplicatas > 0)) return 'parcial';
  return 'sucesso';
}

/**
 * Confirma importação OFX dentro de uma transação SQL (client já em BEGIN).
 * Requer SELECT ... FOR UPDATE em estados feito pelo caller.
 */
export async function confirmOfxImport(client, {
  usuarioId,
  contaId,
  planoId,
  fileName,
  fileContent,
  dados,
}) {
  const { txs, bancoSlug, formato } = parseOfxForImport(fileContent);
  const { empresas, idx, empresa } = resolveEmpresaAtiva(dados);
  const conta = validateConta(empresa, contaId);
  validatePlano(empresa, planoId || null);

  const fingerprints = txs.map((tx) => gerarFingerprint(usuarioId, tx));
  const existingSet = await loadExistingFingerprints(
    (text, params) => client.query(text, params),
    usuarioId,
    fingerprints
  );

  const { transacoes, novas, duplicadas } = classificarTransacoes(usuarioId, txs, existingSet);

  const lancamentos = Array.isArray(empresa.lancamentos) ? [...empresa.lancamentos] : [];
  let codigo = nextCodigo(lancamentos);
  let erros = 0;

  const importacaoId = randomUUID();
  const loteId = `IMP-${importacaoId.replace(/-/g, '').slice(0, 8)}`;
  const novosLancamentos = [];
  const novosFingerprints = [];

  for (const item of transacoes) {
    if (item.status !== 'nova') continue;

    try {
      if (!item.data || !item.valor || !item.tipo) {
        erros += 1;
        continue;
      }

      const lanc = buildLancamento(item._raw, {
        conta,
        contaId,
        planoId: planoId || '',
        loteId,
        codigo,
      });
      codigo += 1;
      novosLancamentos.push(lanc);
      novosFingerprints.push({ fingerprint: item.fingerprint, tx: item._raw });
    } catch {
      erros += 1;
    }
  }

  if (novosLancamentos.length) {
    const novasEmpresas = empresas.map((e, i) =>
      i === idx ? { ...e, lancamentos: [...lancamentos, ...novosLancamentos] } : e
    );
    const novosDados = { ...dados, empresas: novasEmpresas };

    await client.query(
      'UPDATE estados SET dados = $1, updated_at = NOW() WHERE usuario_id = $2',
      [JSON.stringify(novosDados), usuarioId]
    );
  }

  const importados = novosLancamentos.length;
  const status = resolveImportStatus(importados, duplicadas, erros);

  const { rows: impRows } = await client.query(
    `INSERT INTO importacoes (
       id, usuario_id, formato, banco_slug, nome_arquivo,
       conta_id, plano_id, total_linhas, importados, duplicatas, erros,
       lote_id, status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING id`,
    [
      importacaoId,
      usuarioId,
      formato || 'OFX',
      bancoSlug,
      fileName || null,
      contaId,
      planoId || null,
      txs.length,
      importados,
      duplicadas,
      erros,
      loteId,
      status,
    ]
  );

  for (const { fingerprint } of novosFingerprints) {
    await client.query(
      `INSERT INTO importacoes_fingerprints (usuario_id, fingerprint, importacao_id)
       VALUES ($1, $2, $3)`,
      [usuarioId, fingerprint, impRows[0].id]
    );
  }

  return {
    importados,
    duplicados: duplicadas,
    erros,
    importacaoId: impRows[0].id,
    loteId,
    status,
    total: txs.length,
    novas,
    duplicadas,
  };
}

/**
 * Busca lançamentos do JSONB cujo lote coincide com o lote_id da importação (somente leitura).
 */
export function findLancamentosImportados(dados, loteId) {
  if (!loteId || !dados) return [];

  const empresas = Array.isArray(dados.empresas) ? dados.empresas : [];
  const found = [];

  for (const emp of empresas) {
    for (const l of emp.lancamentos || []) {
      if (String(l.lote || '') === String(loteId)) {
        found.push({
          id: l.id,
          data: l.data,
          tipo: l.tipo,
          valor: l.valor,
          historico: l.historico || l.descricao || '',
          planoId: l.planoId || null,
          contaEntradaId: l.contaEntradaId || null,
          contaSaidaId: l.contaSaidaId || null,
          source: l.source || null,
          lote: l.lote,
          createdAt: l.createdAt || null,
        });
      }
    }
  }

  return found.sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
}

/**
 * Remove lançamentos OFX de um lote específico do JSONB (Etapa 4.6D).
 * Retorna novos dados e quantidade removida.
 */
export function removeLancamentosOfxLote(dados, loteId) {
  if (!loteId || !dados) {
    return { novosDados: dados, removidos: 0 };
  }

  const empresas = Array.isArray(dados.empresas) ? dados.empresas : [];
  let removidos = 0;

  const novasEmpresas = empresas.map((emp) => {
    const lancamentos = Array.isArray(emp.lancamentos) ? emp.lancamentos : [];
    const filtrados = lancamentos.filter((l) => {
      const deveRemover =
        String(l.source || '') === 'ofx' &&
        String(l.lote || '') === String(loteId);
      if (deveRemover) removidos += 1;
      return !deveRemover;
    });

    if (filtrados.length === lancamentos.length) return emp;
    return { ...emp, lancamentos: filtrados };
  });

  return {
    novosDados: { ...dados, empresas: novasEmpresas },
    removidos,
  };
}

/**
 * Desfaz importação OFX: remove lançamentos do lote, fingerprints e marca status rollback.
 * Requer transação SQL ativa (client em BEGIN).
 */
export async function rollbackOfxImport(client, { usuarioId, importacaoId }) {
  const { rows: impRows } = await client.query(
    `SELECT id, lote_id, status
     FROM importacoes
     WHERE id = $1 AND usuario_id = $2
     FOR UPDATE`,
    [importacaoId, usuarioId]
  );

  if (!impRows.length) {
    const err = new Error('Importação não encontrada.');
    err.status = 404;
    throw err;
  }

  const importacao = impRows[0];

  if (importacao.status === 'rollback') {
    const err = new Error('Esta importação já foi desfeita.');
    err.status = 409;
    throw err;
  }

  if (!importacao.lote_id) {
    const err = new Error('Importação sem lote associado — rollback indisponível.');
    err.status = 422;
    throw err;
  }

  const { rows: estadoRows } = await client.query(
    'SELECT dados FROM estados WHERE usuario_id = $1 FOR UPDATE',
    [usuarioId]
  );

  if (!estadoRows.length) {
    const err = new Error('Estado do usuário não encontrado.');
    err.status = 422;
    throw err;
  }

  const { novosDados, removidos } = removeLancamentosOfxLote(
    estadoRows[0].dados,
    importacao.lote_id
  );

  await client.query(
    'UPDATE estados SET dados = $1, updated_at = NOW() WHERE usuario_id = $2',
    [JSON.stringify(novosDados), usuarioId]
  );

  await client.query(
    'DELETE FROM importacoes_fingerprints WHERE importacao_id = $1 AND usuario_id = $2',
    [importacaoId, usuarioId]
  );

  await client.query(
    `UPDATE importacoes SET status = 'rollback' WHERE id = $1 AND usuario_id = $2`,
    [importacaoId, usuarioId]
  );

  return {
    ok: true,
    removidos,
    importacaoId: importacao.id,
    loteId: importacao.lote_id,
  };
}
