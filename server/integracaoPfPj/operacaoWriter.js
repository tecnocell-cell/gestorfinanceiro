/**
 * operacaoWriter — Operações bilaterais PJ → PF (pró-labore, lucros, …)
 */

import { randomUUID } from 'crypto';

const SOURCE = 'integracao_pf_pj';

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
        pf: `Lucros recebidos — ${nomePj}${sufixo}`,
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

function resolveEmpresaAtiva(dados) {
  const empresas = Array.isArray(dados?.empresas) ? dados.empresas : [];
  if (!empresas.length) {
    const err = new Error('Estado sem empresa/perfil.');
    err.status = 422;
    throw err;
  }
  const activeId = dados.empresaAtivaId;
  let idx = activeId ? empresas.findIndex((e) => e.id === activeId) : -1;
  if (idx < 0) idx = 0;
  return { empresas, idx, empresa: empresas[idx] };
}

function pickConta(empresa) {
  const contas = Array.isArray(empresa.contas) ? empresa.contas : [];
  return contas.find((c) => !c.inativo) || contas[0] || null;
}

function pickPlanoDespesa(empresa) {
  const planos = Array.isArray(empresa.planoContas) ? empresa.planoContas : [];
  return (
    planos.find((p) => !p.inativo && (p.tipo === 'Despesa' || p.tipo === 'Custo'))
    || planos.find((p) => !p.inativo)
    || null
  );
}

function pickPlanoReceita(empresa) {
  const planos = Array.isArray(empresa.planoContas) ? empresa.planoContas : [];
  return (
    planos.find((p) => !p.inativo && p.tipo === 'Receita')
    || planos.find((p) => !p.inativo)
    || null
  );
}

function parseValor(valor) {
  const n = typeof valor === 'number' ? valor : parseFloat(String(valor || '').replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) {
    const err = new Error('Valor deve ser maior que zero.');
    err.status = 400;
    throw err;
  }
  return Math.round(n * 100) / 100;
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

function buildLancamento({
  tipoOperacao,
  id,
  codigo,
  data,
  tipo,
  valor,
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
  return {
    id,
    codigo,
    data,
    tipo,
    valor: Math.abs(Number(valor)),
    historico,
    descricao: historico,
    planoId: plano?.id || '',
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
  data,
  observacao,
}) {
  assertTipoOperacao(tipoOperacao);
  const config = TIPOS_OPERACAO[tipoOperacao];

  const valorNum = parseValor(valor);
  const dataStr = parseData(data);
  const { empresa: empPj } = resolveEmpresaAtiva(dadosPj);
  const { empresa: empPf } = resolveEmpresaAtiva(dadosPf);

  const contaPj = pickConta(empPj);
  const contaPf = pickConta(empPf);
  const planoPj = pickPlanoDespesa(empPj);
  const planoPf = pickPlanoReceita(empPf);

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
  valor,
  data,
  observacao,
}) {
  assertTipoOperacao(tipoOperacao);
  const config = TIPOS_OPERACAO[tipoOperacao];

  const valorNum = parseValor(valor);
  const dataStr = parseData(data);
  const { empresas: empresasPj, idx: idxPj, empresa: empPj } = resolveEmpresaAtiva(dadosPj);
  const { empresas: empresasPf, idx: idxPf, empresa: empPf } = resolveEmpresaAtiva(dadosPf);

  const contaPj = pickConta(empPj);
  const contaPf = pickConta(empPf);
  const planoPj = pickPlanoDespesa(empPj);
  const planoPf = pickPlanoReceita(empPf);

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
  const valorCentavos = Math.round(valorNum * 100);

  const lancPj = buildLancamento({
    tipoOperacao,
    id: lancamentoPjId,
    codigo: nextCodigo(empPj.lancamentos),
    data: dataStr,
    tipo: 'Saida',
    valor: valorNum,
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

  const lancPf = buildLancamento({
    tipoOperacao,
    id: lancamentoPfId,
    codigo: nextCodigo(empPf.lancamentos),
    data: dataStr,
    tipo: 'Entrada',
    valor: valorNum,
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

  const novasEmpresasPj = empresasPj.map((e, i) =>
    i === idxPj ? { ...e, lancamentos: [...(e.lancamentos || []), lancPj] } : e
  );
  const novasEmpresasPf = empresasPf.map((e, i) =>
    i === idxPf ? { ...e, lancamentos: [...(e.lancamentos || []), lancPf] } : e
  );

  await client.query(
    'UPDATE estados SET dados = $1, updated_at = NOW() WHERE usuario_id = $2',
    [JSON.stringify({ ...dadosPj, empresas: novasEmpresasPj }), usuarioPjId]
  );

  await client.query(
    'UPDATE estados SET dados = $1, updated_at = NOW() WHERE usuario_id = $2',
    [JSON.stringify({ ...dadosPf, empresas: novasEmpresasPf }), vinculo.usuario_pf_id]
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
      valorCentavos,
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

function removeLancamentoById(dados, lancamentoId) {
  const empresas = Array.isArray(dados?.empresas) ? dados.empresas : [];
  let removidos = 0;

  const novasEmpresas = empresas.map((emp) => {
    const lancamentos = Array.isArray(emp.lancamentos) ? emp.lancamentos : [];
    const filtrados = lancamentos.filter((l) => {
      const remove =
        String(l.id) === String(lancamentoId) &&
        String(l.source || '') === SOURCE;
      if (remove) removidos += 1;
      return !remove;
    });
    if (filtrados.length === lancamentos.length) return emp;
    return { ...emp, lancamentos: filtrados };
  });

  return { novosDados: { ...dados, empresas: novasEmpresas }, removidos };
}

export async function rollbackOperacao(client, {
  usuarioPjId,
  operacaoId,
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

  const { novosDados: dadosPj, removidos: remPj } = removeLancamentoById(
    dadosPjRaw,
    op.lancamento_pj_id
  );
  const { novosDados: dadosPf, removidos: remPf } = removeLancamentoById(
    dadosPfRaw,
    op.lancamento_pf_id
  );

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

export function mapOperacao(row) {
  if (!row) return null;
  return {
    id: row.id,
    vinculoId: row.vinculo_id,
    tipoOperacao: row.tipo_operacao,
    valor: row.valor_centavos / 100,
    valorCentavos: Number(row.valor_centavos),
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
