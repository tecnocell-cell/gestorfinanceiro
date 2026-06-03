/**
 * Agendamentos PF/PJ — cadastro mensal, geração manual via operacaoWriter.
 */
import { confirmOperacao, TIPOS_OPERACAO } from './operacaoWriter.js';
import { parseCentavosInteiro, reaisFromCentavos, resolveValorCentavos } from '../utils/money.js';

export const AGENDAMENTO_STATUS = ['ativa', 'pausada', 'encerrada'];

const TIPOS = Object.keys(TIPOS_OPERACAO);

export function assertTipoAgendamento(tipo) {
  if (!TIPOS.includes(tipo)) {
    const err = new Error(`Tipo de operação inválido: ${tipo}`);
    err.status = 400;
    throw err;
  }
}

export function mapAgendamento(row) {
  if (!row) return null;
  const valorCentavos = parseCentavosInteiro(row.valor_centavos) ?? 0;
  return {
    id: row.id,
    vinculoId: row.vinculo_id,
    usuarioPjId: row.usuario_pj_id,
    tipoOperacao: row.tipo_operacao,
    valorCentavos,
    valor: reaisFromCentavos(valorCentavos),
    diaMes: Number(row.dia_mes),
    observacao: row.observacao || '',
    status: row.status,
    ultimoGeradoMes: row.ultimo_gerado_mes || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** @returns {string} YYYY-MM */
export function mesReferenciaAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** @returns {string} YYYY-MM */
export function parseMesReferencia(input) {
  const raw = String(input || '').trim();
  const mes = raw || mesReferenciaAtual();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
    const err = new Error('Mês inválido. Use o formato YYYY-MM.');
    err.status = 400;
    throw err;
  }
  return mes;
}

/** Data da operação no mês (dia_mes limitado ao último dia do mês). */
export function dataOperacaoNoMes(mesRef, diaMes) {
  const [anoStr, mesStr] = mesRef.split('-');
  const ano = Number(anoStr);
  const mes = Number(mesStr);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const dia = Math.min(Math.max(1, Math.trunc(Number(diaMes) || 1)), ultimoDia);
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export function centavosFromAgendamentoBody(body = {}) {
  return resolveValorCentavos({
    valorCentavos: body.valorCentavos ?? body.valor_centavos,
    valor_centavos: body.valor_centavos ?? body.valorCentavos,
    valor: body.valor,
  });
}

export function parseDiaMes(input) {
  const dia = Math.trunc(Number(input));
  if (!Number.isFinite(dia) || dia < 1 || dia > 31) {
    const err = new Error('Dia do mês deve ser entre 1 e 31.');
    err.status = 400;
    throw err;
  }
  return dia;
}

export function observacaoParaGeracao(observacao, mesRef) {
  const base = String(observacao || '').trim();
  const sufixo = `Agendamento ${mesRef}`;
  return base ? `${base} — ${sufixo}` : sufixo;
}

async function refreshEstados(client, usuarioPjId, usuarioPfId) {
  const sorted = [usuarioPjId, usuarioPfId].sort();
  const out = {};
  for (const uid of sorted) {
    const { rows } = await client.query(
      'SELECT dados FROM estados WHERE usuario_id = $1',
      [uid]
    );
    if (!rows.length) {
      const err = new Error('Estado PJ ou PF não encontrado.');
      err.status = 422;
      throw err;
    }
    out[uid] = rows[0].dados;
  }
  return out;
}

/**
 * Gera repasses do mês para agendamentos ativos (não executa automaticamente).
 * @returns {{ mes, gerados, ignorados }}
 */
export async function gerarRepassesDoMes(client, {
  usuarioPjId,
  vinculo,
  nomePj,
  pjProfile,
  pfProfile,
  mesRef,
  agendamentos,
  forcar = false,
}) {
  const gerados = [];
  const ignorados = [];
  let estados = await refreshEstados(client, usuarioPjId, vinculo.usuario_pf_id);

  for (const ag of agendamentos) {
    if (ag.status !== 'ativa') {
      ignorados.push({ agendamentoId: ag.id, motivo: 'pausada_ou_encerrada' });
      continue;
    }
    if (!forcar && ag.ultimo_gerado_mes === mesRef) {
      ignorados.push({ agendamentoId: ag.id, motivo: 'ja_gerado' });
      continue;
    }

    const dataOp = dataOperacaoNoMes(mesRef, ag.dia_mes);
    const obs = observacaoParaGeracao(ag.observacao, mesRef);

    const result = await confirmOperacao(client, ag.tipo_operacao, {
      usuarioPjId,
      vinculo,
      nomePj,
      dadosPj: estados[usuarioPjId],
      dadosPf: estados[vinculo.usuario_pf_id],
      pjProfile,
      pfProfile,
      centavosInput: ag.valor_centavos,
      data: dataOp,
      observacao: obs,
    });

    await client.query(
      `UPDATE integracao_pf_pj_agendamentos
       SET ultimo_gerado_mes = $2, updated_at = NOW()
       WHERE id = $1`,
      [ag.id, mesRef]
    );

    gerados.push({
      agendamentoId: ag.id,
      operacaoId: result.operacao?.id,
      tipoOperacao: ag.tipo_operacao,
      data: dataOp,
      valorCentavos: parseCentavosInteiro(ag.valor_centavos),
    });

    estados = await refreshEstados(client, usuarioPjId, vinculo.usuario_pf_id);
  }

  return { mes: mesRef, gerados, ignorados };
}
