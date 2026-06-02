/**
 * operacaoWriter — Operações bilaterais PJ → PF (pró-labore, lucros, …)
 */

import { randomUUID } from 'crypto';
import {
  SOURCE_INTEGRACAO,
  appendLancamentoToEstado,
  collectAllLancamentos,
  prepareEstadoForWrite,
  profileForPf,
  profileForPj,
  removeIntegracaoOperacaoPrepared,
  resolveEmpresaAtiva,
  toUserProfile,
} from './estadoMerge.js';
import {
  pickPlanoDespesaPj,
  pickPlanoReceitaPf,
  snapshotPlanoCampos,
  validateLancamentoPfIntegracao,
  validateLancamentoPjIntegracao,
} from './lancamentoPfPj.js';
import {
  parseCentavosInteiro,
  parseValor,
  reaisFromCentavos,
  reaisToCentavos,
  resolveValorCentavos,
} from '../utils/money.js';

function parseCentavosFromRow(raw) {
  return parseCentavosInteiro(raw) ?? 0;
}

const SOURCE = SOURCE_INTEGRACAO;

export const TIPOS_OPERACAO = {
  pro_labore: {
    buildHistoricos({ nomePf, nomePj, observacao }) {
      const obs = String(observacao || '').trim();
      const sufixo = obs ? ` — ${obs}` : '';
      return {
        pj: `Pró-labore — ${nomePf}${sufixo}`,
        pf: `Pró-labore recebido — ${nomePj}${sufixo}`,
        resumo: `Pró-labore — ${nomePf}${sufixo}`,
      };
    },
  },
  distribuicao_lucros: {
    buildHistoricos({ nomePf, nomePj, observacao }) {
      const obs = String(observacao || '').trim();
      const sufixo = obs ? ` — ${obs}` : '';
      return {
        pj: `Distribuição de lucros — ${nomePf}${sufixo}`,
        pf: `Distribuição de Lucros recebida — ${nomePj}${sufixo}`,
        resumo: `Distribuição de lucros — ${nomePf}${sufixo}`,
      };
    },
  },
  salario: {
    buildHistoricos({ nomePf, nomePj, observacao }) {
      const obs = String(observacao || '').trim();
      const sufixo = obs ? ` — ${obs}` : '';
      return {
        pj: `Salário — ${nomePf}${sufixo}`,
        pf: `Salário recebido — ${nomePj}${sufixo}`,
        resumo: `Salário — ${nomePf}${sufixo}`,
      };
    },
  },
  transferencia_pj_pf: {
    buildHistoricos({ nomePf, nomePj, observacao }) {
      const obs = String(observacao || '').trim();
      const sufixo = obs ? ` — ${obs}` : '';
      return {
        pj: `Transferência PJ→PF — ${nomePf}${sufixo}`,
        pf: `Transferência recebida — ${nomePj}${sufixo}`,
        resumo: `Transferência PJ→PF — ${nomePf}${sufixo}`,
      };
    },
  },
};

function assertTipoOperacao(tipoOperacao) {
  if (!TIPOS_OPERACAO[tipoOperacao]) {
    const err = new Error(`Tipo de operação inválido: ${tipoOperacao}`);
    err.status = 400;
    throw err;
  }
}

function nextCodigo(lancamentos) {
  const nums = (lancamentos || [])
    .map((l) => Number(l.codigo))
    .filter((n) => Number.isFinite(n) && n > 0);
  return nums.length ? Math.max(...nums) + 1 : 1;
}

function resolveEmpresaForPreview(dadosPj, dadosPf) {
  const pj = prepareEstadoForWrite(dadosPj, { tipo_perfil: 'juridica' });
  const pf = prepareEstadoForWrite(dadosPf, { tipo_perfil: 'fisica' });
  return {
    empPj: resolveEmpresaAtiva(pj).empresa,
    empPf: resolveEmpresaAtiva(pf).empresa,
  };
}

function pickConta(empresa) {
  const contas = Array.isArray(empresa.contas) ? empresa.contas : [];
  return contas.find((c) => !c.inativo) || contas[0] || null;
}

function parseData(raw) {
  const s = String(raw || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const err = new Error('Data inválida. Use formato AAAA-MM-DD.');
    err.status = 400;
    throw err;
  }
  return s;
}

export function buildIntegracaoLancamento({
  tipoOperacao,
  id,
  codigo,
  data,
  tipo,
  valorCentavos,
  historico,
  conta,
  plano,
  operacaoId,
  vinculoId,
  lancamentoParId,
  lado,
  usuarioPjId,
  usuarioPfId,
}) {
  const isEntrada = tipo === 'Entrada';
  const planoSnap = snapshotPlanoCampos(plano, tipo);
  return {
    id,
    codigo,
    data,
    tipo,
    valor: reaisFromCentavos(valorCentavos),
    historico,
    descricao: historico,
    ...planoSnap,
    contaEntradaId: isEntrada ? conta.id : null,
    contaSaidaId: !isEntrada ? conta.id : null,
    codigoDestino: isEntrada ? (conta.codigo ?? null) : null,
    codigoOrigem: !isEntrada ? (conta.codigo ?? null) : null,
    pago: true,
    lote: null,
    tipoOrigem: '',
    tipoDestino: '',
    natureza: isEntrada ? 'Credito' : 'Debito',
    consiliado: false,
    exportado: false,
    clienteId: null,
    fornecedorId: null,
    createdAt: new Date().toISOString(),
    source: SOURCE,
    tipoOperacao,
    integracaoPfPj: {
      operacaoId,
      vinculoId,
      tipoOperacao,
      lado,
      lancamentoParId,
      usuarioPjId,
      usuarioPfId,
      criadoEm: new Date().toISOString(),
    },
  };
}

export function previewOperacao(tipoOperacao, {
  dadosPj,
  dadosPf,
  vinculo,
  nomePj,
  valor,
  centavosInput,
  valorCentavos: valorCentavosLegacy,
  data,
  observacao,
}) {
  assertTipoOperacao(tipoOperacao);
  const config = TIPOS_OPERACAO[tipoOperacao];

  const centsResolved =
    centavosInput ??
    resolveValorCentavos({
      valorCentavos: valorCentavosLegacy,
      valor_centavos: valorCentavosLegacy,
      valor,
    });
  const valorNum = reaisFromCentavos(centsResolved);
  const dataStr = parseData(data);
  const { empPj, empPf } = resolveEmpresaForPreview(dadosPj, dadosPf);

  const contaPj = pickConta(empPj);
  const contaPf = pickConta(empPf);
  const planoPj = pickPlanoDespesaPj(empPj, tipoOperacao);
  const planoPf = pickPlanoReceitaPf(empPf, tipoOperacao);

  if (!contaPj || !contaPf) {
    const err = new Error('Conta bancária ativa não encontrada em PJ ou PF.');
    err.status = 422;
    throw err;
  }

  const historicos = config.buildHistoricos({
    nomePf: vinculo.nome_pf,
    nomePj: nomePj || 'Empresa PJ',
    observacao,
  });

  const operacaoId = randomUUID();
  const lancamentoPjId = randomUUID();
  const lancamentoPfId = randomUUID();

  return {
    operacaoId,
    vinculoId: vinculo.id,
    tipoOperacao,
    valor: valorNum,
    data: dataStr,
    historico: historicos.resumo,
    lancamentoPj: {
      data: dataStr,
      tipo: 'Saida',
      valor: valorNum,
      historico: historicos.pj,
      conta: contaPj.apelido || contaPj.nome,
      plano: planoPj?.descricao || '—',
    },
    lancamentoPf: {
      data: dataStr,
      tipo: 'Entrada',
      valor: valorNum,
      historico: historicos.pf,
      conta: contaPf.apelido || contaPf.nome,
      plano: planoPf?.descricao || '—',
    },
    lancamentoPjId,
    lancamentoPfId,
  };
}

export async function confirmOperacao(client, tipoOperacao, {
  usuarioPjId,
  vinculo,
  nomePj,
  dadosPj,
  dadosPf,
  pjProfile,
  pfProfile,
  valor,
  centavosInput,
  valorCentavos: valorCentavosLegacy,
  data,
  observacao,
}) {
  assertTipoOperacao(tipoOperacao);
  const config = TIPOS_OPERACAO[tipoOperacao];

  let centsOperacao;
  try {
    centsOperacao =
      centavosInput ??
      resolveValorCentavos({
        valorCentavos: valorCentavosLegacy,
        valor_centavos: valorCentavosLegacy,
        valor,
      });
  } catch (e) {
    if (e.status) throw e;
    const err = new Error('Valor deve ser maior que zero.');
    err.status = 400;
    throw err;
  }
  centsOperacao = reaisToCentavos(reaisFromCentavos(centsOperacao));
  const valorNum = reaisFromCentavos(centsOperacao);
  const dataStr = parseData(data);
  const pfProf = profileForPf(pfProfile, vinculo.nome_pf);
  const pjProf = profileForPj(pjProfile, nomePj);
  const preparedPj = prepareEstadoForWrite(dadosPj, pjProf);
  const preparedPf = prepareEstadoForWrite(dadosPf, pfProf);
  const empPj = resolveEmpresaAtiva(preparedPj).empresa;
  const empPf = resolveEmpresaAtiva(preparedPf).empresa;

  const contaPj = pickConta(empPj);
  const contaPf = pickConta(empPf);
  const planoPj = pickPlanoDespesaPj(empPj, tipoOperacao);
  const planoPf = pickPlanoReceitaPf(empPf, tipoOperacao);

  if (!contaPj || !contaPf) {
    const err = new Error('Conta bancária ativa não encontrada em PJ ou PF.');
    err.status = 422;
    throw err;
  }

  const historicos = config.buildHistoricos({
    nomePf: vinculo.nome_pf,
    nomePj: nomePj || 'Empresa PJ',
    observacao,
  });

  const operacaoId = randomUUID();
  const lancamentoPjId = randomUUID();
  const lancamentoPfId = randomUUID();

  const lancPj = buildIntegracaoLancamento({
    tipoOperacao,
    id: lancamentoPjId,
    codigo: nextCodigo(collectAllLancamentos(preparedPj)),
    data: dataStr,
    tipo: 'Saida',
    valorCentavos: centsOperacao,
    historico: historicos.pj,
    conta: contaPj,
    plano: planoPj,
    operacaoId,
    vinculoId: vinculo.id,
    lancamentoParId: lancamentoPfId,
    lado: 'pj',
    usuarioPjId,
    usuarioPfId: vinculo.usuario_pf_id,
  });

  const lancPf = buildIntegracaoLancamento({
    tipoOperacao,
    id: lancamentoPfId,
    codigo: nextCodigo(collectAllLancamentos(preparedPf)),
    data: dataStr,
    tipo: 'Entrada',
    valorCentavos: centsOperacao,
    historico: historicos.pf,
    conta: contaPf,
    plano: planoPf,
    operacaoId,
    vinculoId: vinculo.id,
    lancamentoParId: lancamentoPjId,
    lado: 'pf',
    usuarioPjId,
    usuarioPfId: vinculo.usuario_pf_id,
  });

  const errosPj = validateLancamentoPjIntegracao(lancPj, empPj);
  if (errosPj.length) {
    const err = new Error(`Lançamento PJ inválido: ${errosPj.join('; ')}`);
    err.status = 500;
    throw err;
  }

  const errosPf = validateLancamentoPfIntegracao(lancPf, empPf);
  if (errosPf.length) {
    const err = new Error(`Lançamento PF inválido: ${errosPf.join('; ')}`);
    err.status = 500;
    throw err;
  }

  const centPj = reaisToCentavos(lancPj.valor);
  const centPf = reaisToCentavos(lancPf.valor);
  if (centPj !== centPf) {
    const err = new Error('Valores PJ e PF divergem após montar lançamentos.');
    err.status = 500;
    throw err;
  }
  centsOperacao = centPj;

  const novosDadosPj = appendLancamentoToEstado(preparedPj, lancPj, pjProf);
  const novosDadosPf = appendLancamentoToEstado(preparedPf, lancPf, pfProf);

  await client.query(
    'UPDATE estados SET dados = $1, updated_at = NOW() WHERE usuario_id = $2',
    [JSON.stringify(novosDadosPj), usuarioPjId]
  );

  await client.query(
    'UPDATE estados SET dados = $1, updated_at = NOW() WHERE usuario_id = $2',
    [JSON.stringify(novosDadosPf), vinculo.usuario_pf_id]
  );

  const { rows: opRows } = await client.query(
    `INSERT INTO integracao_pf_pj_operacoes (
       id, vinculo_id, tipo_operacao, valor_centavos, data, historico,
       lancamento_pj_id, lancamento_pf_id, status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'ok')
     RETURNING id, vinculo_id, tipo_operacao, valor_centavos, data, historico,
               lancamento_pj_id, lancamento_pf_id, status, created_at`,
    [
      operacaoId,
      vinculo.id,
      tipoOperacao,
      centsOperacao,
      dataStr,
      historicos.resumo,
      lancamentoPjId,
      lancamentoPfId,
    ]
  );

  return {
    operacao: mapOperacao(opRows[0]),
    lancamentoPjId,
    lancamentoPfId,
  };
}

async function loadUserProfile(client, usuarioId) {
  const { rows } = await client.query(
    'SELECT tipo_perfil, nome_perfil, nome FROM usuarios WHERE id = $1',
    [usuarioId]
  );
  return toUserProfile(rows[0]);
}

export async function rollbackOperacao(client, {
  usuarioPjId,
  operacaoId,
  pjProfile,
  pfProfile,
}) {
  const { rows: opRows } = await client.query(
    `SELECT o.*, v.usuario_pj_id, v.usuario_pf_id
     FROM integracao_pf_pj_operacoes o
     JOIN integracao_pf_pj_vinculo v ON v.id = o.vinculo_id
     WHERE o.id = $1 AND v.usuario_pj_id = $2
     FOR UPDATE`,
    [operacaoId, usuarioPjId]
  );

  if (!opRows.length) {
    const err = new Error('Operação não encontrada.');
    err.status = 404;
    throw err;
  }

  const op = opRows[0];

  const pjRow = pjProfile || await loadUserProfile(client, op.usuario_pj_id);
  const pfRow = pfProfile || await loadUserProfile(client, op.usuario_pf_id);
  const pjWrite = profileForPj(pjRow);
  const pfWrite = profileForPf(pfRow, op.nome_pf);

  if (op.status === 'rollback') {
    const err = new Error('Esta operação já foi desfeita.');
    err.status = 409;
    throw err;
  }

  const [firstId, secondId] = [op.usuario_pj_id, op.usuario_pf_id].sort();

  let dadosPjRaw;
  let dadosPfRaw;

  for (const uid of [firstId, secondId]) {
    const { rows } = await client.query(
      'SELECT usuario_id, dados FROM estados WHERE usuario_id = $1 FOR UPDATE',
      [uid]
    );
    if (!rows.length) {
      const err = new Error('Estado PJ ou PF não encontrado.');
      err.status = 422;
      throw err;
    }
    if (uid === op.usuario_pj_id) dadosPjRaw = rows[0].dados;
    else dadosPfRaw = rows[0].dados;
  }

  const rollbackOpts = {
    operacaoId: op.id,
    lancamentoPjId: op.lancamento_pj_id,
    lancamentoPfId: op.lancamento_pf_id,
  };

  const { novosDados: dadosPj, removidos: remPj } = removeIntegracaoOperacaoPrepared(
    dadosPjRaw,
    rollbackOpts,
    pjWrite
  );
  const { novosDados: dadosPf, removidos: remPf } = removeIntegracaoOperacaoPrepared(
    dadosPfRaw,
    rollbackOpts,
    pfWrite
  );

  if (remPj === 0 || remPf === 0) {
    console.warn(
      `rollback ${op.id}: removidos PJ=${remPj} PF=${remPf} (pj=${op.lancamento_pj_id}, pf=${op.lancamento_pf_id})`
    );
  }

  await client.query(
    'UPDATE estados SET dados = $1, updated_at = NOW() WHERE usuario_id = $2',
    [JSON.stringify(dadosPj), op.usuario_pj_id]
  );
  await client.query(
    'UPDATE estados SET dados = $1, updated_at = NOW() WHERE usuario_id = $2',
    [JSON.stringify(dadosPf), op.usuario_pf_id]
  );

  await client.query(
    `UPDATE integracao_pf_pj_operacoes SET status = 'rollback' WHERE id = $1`,
    [operacaoId]
  );

  return {
    ok: true,
    operacaoId: op.id,
    removidos: remPj + remPf,
    removidosPj: remPj,
    removidosPf: remPf,
  };
}

/** Reconstrói par PJ/PF a partir de operação confirmada (reparo quando o estado foi sobrescrito). */
export function rebuildIntegracaoLancamentosForOperacao(op, empPj, empPf, {
  vinculo,
  nomePj,
  usuarioPjId,
}) {
  assertTipoOperacao(op.tipo_operacao);
  const config = TIPOS_OPERACAO[op.tipo_operacao];
  const valorCentavos = parseCentavosFromRow(op.valor_centavos);
  const dataStr = op.data instanceof Date
    ? op.data.toISOString().slice(0, 10)
    : String(op.data).slice(0, 10);

  const contaPj = pickConta(empPj);
  const contaPf = pickConta(empPf);
  const planoPj = pickPlanoDespesaPj(empPj, op.tipo_operacao);
  const planoPf = pickPlanoReceitaPf(empPf, op.tipo_operacao);
  if (!contaPj || !contaPf) {
    throw new Error(`Conta ativa ausente para operação ${op.id}`);
  }

  const historicos = config.buildHistoricos({
    nomePf: vinculo.nome_pf,
    nomePj: nomePj || 'Empresa PJ',
    observacao: '',
  });

  const operacaoId = op.id;
  const lancamentoPjId = op.lancamento_pj_id;
  const lancamentoPfId = op.lancamento_pf_id;

  const lancPj = buildIntegracaoLancamento({
    tipoOperacao: op.tipo_operacao,
    id: lancamentoPjId,
    codigo: 0,
    data: dataStr,
    tipo: 'Saida',
    valorCentavos,
    historico: historicos.pj,
    conta: contaPj,
    plano: planoPj,
    operacaoId,
    vinculoId: vinculo.id,
    lancamentoParId: lancamentoPfId,
    lado: 'pj',
    usuarioPjId,
    usuarioPfId: vinculo.usuario_pf_id,
  });

  const lancPf = buildIntegracaoLancamento({
    tipoOperacao: op.tipo_operacao,
    id: lancamentoPfId,
    codigo: 0,
    data: dataStr,
    tipo: 'Entrada',
    valorCentavos,
    historico: historicos.pf,
    conta: contaPf,
    plano: planoPf,
    operacaoId,
    vinculoId: vinculo.id,
    lancamentoParId: lancamentoPjId,
    lado: 'pf',
    usuarioPjId,
    usuarioPfId: vinculo.usuario_pf_id,
  });

  return { lancPj, lancPf };
}

export function mapOperacao(row) {
  if (!row) return null;
  const valorCentavos = parseCentavosFromRow(row.valor_centavos);
  return {
    id: row.id,
    vinculoId: row.vinculo_id,
    tipoOperacao: row.tipo_operacao,
    valor: reaisFromCentavos(valorCentavos),
    valorCentavos,
    data: row.data instanceof Date
      ? row.data.toISOString().slice(0, 10)
      : String(row.data).slice(0, 10),
    historico: row.historico,
    lancamentoPjId: row.lancamento_pj_id,
    lancamentoPfId: row.lancamento_pf_id,
    status: row.status,
    createdAt: row.created_at,
  };
}
