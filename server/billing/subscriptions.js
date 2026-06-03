import { query } from '../db.js';
import { mergeRecursos, buildLimiteAvisos } from './planResources.js';

const TRIAL_DAYS = parseInt(process.env.BILLING_TRIAL_DAYS || '14', 10);

export async function listPlanosAtivos() {
  const { rows } = await query(
    `SELECT id, slug, nome, descricao, preco_centavos, intervalo, recursos, ativo, created_at
     FROM planos WHERE ativo = true ORDER BY preco_centavos ASC`
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
  const recursos = mergeRecursos(row.plano_slug, row.plano_recursos);
  return {
    id: row.id,
    status: row.status,
    inicio_em: row.inicio_em,
    fim_em: row.fim_em,
    trial_ate: row.trial_ate,
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

export async function ensureAssinaturaPadrao(usuarioId) {
  const existing = await query(
    `SELECT a.id FROM assinaturas a WHERE a.usuario_id = $1`,
    [usuarioId]
  );
  if (existing.rows.length) return existing.rows[0].id;

  const free = await getPlanoBySlug('free');
  if (!free) throw new Error('Plano Free não encontrado. Execute a migration 023.');

  const trialAte = new Date();
  trialAte.setDate(trialAte.getDate() + TRIAL_DAYS);

  const { rows } = await query(
    `INSERT INTO assinaturas (usuario_id, plano_id, status, inicio_em, trial_ate)
     VALUES ($1, $2, 'trial', NOW(), $3)
     RETURNING id`,
    [usuarioId, free.id, trialAte]
  );
  return rows[0].id;
}

async function fetchAssinaturaRow(usuarioId) {
  const { rows } = await query(
    `SELECT a.id, a.usuario_id, a.plano_id, a.status, a.inicio_em, a.fim_em, a.trial_ate,
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
  const row = await fetchAssinaturaRow(usuarioId);
  if (!row) return null;

  const totalLancamentos = await countLancamentosUsuario(usuarioId);
  const recursos = mergeRecursos(row.plano_slug, row.plano_recursos);
  const avisos = buildLimiteAvisos({ recursos, totalLancamentos });

  return formatAssinatura(row, {
    total_lancamentos: totalLancamentos,
    avisos,
    pagamentos_reais: false,
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
  if (plano.slug === 'free') {
    return { ok: false, error: 'Use outro plano para simular upgrade (Pro ou Empresarial).' };
  }

  await ensureAssinaturaPadrao(usuarioId);
  const fim = periodEndFromInterval(plano.intervalo);

  await query(
    `UPDATE assinaturas
     SET plano_id = $1,
         status = 'ativa',
         trial_ate = NULL,
         fim_em = $2,
         updated_at = NOW()
     WHERE usuario_id = $3`,
    [plano.id, fim, usuarioId]
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
