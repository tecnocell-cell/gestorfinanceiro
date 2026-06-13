import { query } from '../db.js';
import {
  mergeRecursos,
  buildLimiteAvisos,
  defaultPlanoSlugForTipo,
  segmentoFromTipoPerfil,
  planoMatchesTipoPerfil,
  applyRecursosByStatus,
} from './planResources.js';
import { isPagamentosOnlineEnabled } from './paymentGatewayFactory.js';
import {
  refreshSubscriptionLifecycle,
  buildBillingAvisos,
} from './subscriptionLifecycle.js';
import { corrigirAssinaturaSegmento } from './planoCorrecao.js';


function trialDaysForTipo(tipoPerfil) {
  return segmentoFromTipoPerfil(tipoPerfil) === 'pf' ? 7 : 14;
}

export async function listPlanosAtivos(tipoPerfil) {
  const segmento = segmentoFromTipoPerfil(tipoPerfil);
  const { rows } = await query(
    `SELECT id, slug, nome, descricao, preco_centavos, intervalo, recursos, ativo, created_at
     FROM planos
     WHERE ativo = true AND slug LIKE $1
     ORDER BY preco_centavos ASC`,
    [`${segmento}_%`]
  );
  return rows.map(formatPlano);
}

export async function getPlanoBySlug(slug) {
  const { rows } = await query(
    `SELECT id, slug, nome, descricao, preco_centavos, intervalo, recursos, ativo
     FROM planos WHERE slug = $1 AND ativo = true`,
    [slug]
  );
  return rows[0] || null;
}

async function getUsuarioTipoPerfil(usuarioId) {
  const { rows } = await query(
    `SELECT tipo_perfil FROM usuarios WHERE id = $1`,
    [usuarioId]
  );
  return rows[0]?.tipo_perfil || 'juridica';
}

async function countLancamentosUsuario(usuarioId) {
  const { rows } = await query('SELECT dados FROM estados WHERE usuario_id = $1', [usuarioId]);
  const emp = rows[0]?.dados?.empresas?.[0];
  const lancamentos = emp?.lancamentos || [];
  return Array.isArray(lancamentos) ? lancamentos.length : 0;
}

function formatPlano(row) {
  const recursos = mergeRecursos(row.slug, row.recursos);
  return {
    id: row.id,
    slug: row.slug,
    nome: row.nome,
    descricao: row.descricao,
    preco_centavos: row.preco_centavos,
    preco_formatado: formatPreco(row.preco_centavos),
    intervalo: row.intervalo,
    recursos,
    segmento: recursos.segmento,
    ativo: row.ativo,
  };
}

function formatPreco(centavos) {
  if (!centavos) return 'Grátis';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    centavos / 100
  );
}

function formatAssinatura(row, extras = {}) {
  let recursos = mergeRecursos(row.plano_slug, row.plano_recursos);
  recursos = applyRecursosByStatus(recursos, row.status, row.plano_slug);

  return {
    id: row.id,
    status: row.status,
    inicio_em: row.inicio_em,
    fim_em: row.fim_em,
    trial_ate: row.trial_ate,
    proxima_cobranca: row.proxima_cobranca,
    cancelada_em: row.cancelada_em,
    acesso_ate: row.acesso_ate,
    plano: {
      id: row.plano_id,
      slug: row.plano_slug,
      nome: row.plano_nome,
      descricao: row.plano_descricao,
      preco_centavos: row.preco_centavos,
      preco_formatado: formatPreco(row.preco_centavos),
      intervalo: row.plano_intervalo,
      recursos,
    },
    recursos,
    ...extras,
  };
}

export async function ensureAssinaturaPadrao(usuarioId, planoSlugOverride = null) {
  // Fast-path: já existe
  const existing = await query(
    `SELECT id FROM assinaturas WHERE usuario_id = $1`,
    [usuarioId]
  );
  if (existing.rows.length) return existing.rows[0].id;

  const tipoPerfil = await getUsuarioTipoPerfil(usuarioId);

  // Usa o plano escolhido se válido para o tipo de perfil; caso contrário usa o padrão
  let slugFinal = defaultPlanoSlugForTipo(tipoPerfil);
  if (planoSlugOverride && planoMatchesTipoPerfil(planoSlugOverride, tipoPerfil)) {
    const candidato = await getPlanoBySlug(planoSlugOverride);
    if (candidato) slugFinal = planoSlugOverride;
  }

  const plano = await getPlanoBySlug(slugFinal);
  if (!plano) {
    throw new Error(
      `Plano ${slugFinal} não encontrado. Execute migrations 023 e 024.`
    );
  }

  const trialAte = new Date();
  trialAte.setDate(trialAte.getDate() + trialDaysForTipo(tipoPerfil));

  // UPSERT atômico: requests simultâneos não geram duplicate key
  await query(
    `INSERT INTO assinaturas (usuario_id, plano_id, status, inicio_em, trial_ate)
     VALUES ($1, $2, 'trial', NOW(), $3)
     ON CONFLICT (usuario_id) DO NOTHING`,
    [usuarioId, plano.id, trialAte]
  );

  // Sempre busca a linha resultante (criada agora ou já existente)
  const { rows } = await query(
    `SELECT id FROM assinaturas WHERE usuario_id = $1`,
    [usuarioId]
  );
  return rows[0].id;
}

async function fetchAssinaturaRow(usuarioId) {
  const { rows } = await query(
    `SELECT a.id, a.usuario_id, a.plano_id, a.status, a.inicio_em, a.fim_em, a.trial_ate,
            a.proxima_cobranca, a.cancelada_em, a.acesso_ate,
            p.slug AS plano_slug, p.nome AS plano_nome, p.descricao AS plano_descricao,
            p.preco_centavos, p.intervalo AS plano_intervalo, p.recursos AS plano_recursos
     FROM assinaturas a
     JOIN planos p ON p.id = a.plano_id
     WHERE a.usuario_id = $1`,
    [usuarioId]
  );
  return rows[0] || null;
}

export async function getAssinaturaUsuario(usuarioId) {
  await ensureAssinaturaPadrao(usuarioId);
  await corrigirAssinaturaSegmento(usuarioId);
  await refreshSubscriptionLifecycle(usuarioId);
  const row = await fetchAssinaturaRow(usuarioId);
  if (!row) return null;

  const totalLancamentos = await countLancamentosUsuario(usuarioId);
  let recursos = mergeRecursos(row.plano_slug, row.plano_recursos);
  recursos = applyRecursosByStatus(recursos, row.status, row.plano_slug);
  const avisos = [
    ...buildLimiteAvisos({ recursos, totalLancamentos }),
    ...buildBillingAvisos(row),
  ];

  return formatAssinatura(row, {
    total_lancamentos: totalLancamentos,
    avisos,
    pagamentos_reais: await isPagamentosOnlineEnabled(),
  });
}

function periodEndFromInterval(intervalo) {
  const end = new Date();
  if (intervalo === 'anual') {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return end;
}

export async function simularUpgrade(usuarioId, planoSlug) {
  const plano = await getPlanoBySlug(planoSlug);
  if (!plano) return { ok: false, error: 'Plano não encontrado.' };

  const tipoPerfil = await getUsuarioTipoPerfil(usuarioId);
  if (!planoMatchesTipoPerfil(plano.slug, tipoPerfil)) {
    return {
      ok: false,
      error: 'Este plano não está disponível para o seu tipo de perfil (PF/PJ).',
    };
  }

  await ensureAssinaturaPadrao(usuarioId);
  const fim = periodEndFromInterval(plano.intervalo);
  const proxima = new Date(fim);

  await query(
    `UPDATE assinaturas
     SET plano_id = $1,
         status = 'ativa',
         trial_ate = NULL,
         fim_em = $2,
         proxima_cobranca = $3,
         cancelada_em = NULL,
         acesso_ate = NULL,
         updated_at = NOW()
     WHERE usuario_id = $4`,
    [plano.id, fim, proxima, usuarioId]
  );

  const assinatura = await getAssinaturaUsuario(usuarioId);
  return { ok: true, message: `Plano simulado: ${plano.nome}. Sem cobrança real.`, assinatura };
}

export function isSimulateAllowed() {
  return (
    process.env.BILLING_ALLOW_SIMULATE === 'true' ||
    process.env.NODE_ENV !== 'production'
  );
}
