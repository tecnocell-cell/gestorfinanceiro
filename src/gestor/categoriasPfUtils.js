/**
 * Detecção de categorias PJ vs PF (plano de contas).
 * Compartilhado entre frontend (storage) e servidor (normalização/reparo).
 */

export const PJ_DESCRICOES_PADRAO = new Set([
  'receitas operacionais',
  'custos operacionais',
  'despesas administrativas',
  'simples nacional',
]);

export const PF_DESCRICOES_PADRAO = [
  'Salário',
  'Freelance',
  'Investimentos',
  'Outros Recebimentos',
  'Moradia',
  'Alimentação',
  'Transporte',
  'Saúde',
  'Educação',
  'Lazer',
  'Vestuário',
  'Outros Gastos',
];

/** Categoria típica de PJ (DRE empresarial). */
export function isPlanoContasPJ(item) {
  if (!item) return false;
  const tipo = String(item.tipo || '').toLowerCase();
  if (tipo === 'custo' || tipo === 'imposto') return true;

  const cod = String(item.codigo || '').trim();
  if (/^\d\.\d\.\d{3}$/.test(cod)) return true;

  const desc = String(item.descricao || '').trim().toLowerCase();
  if (PJ_DESCRICOES_PADRAO.has(desc)) return true;

  const cls = String(item.classificacao || '').toUpperCase();
  if (cls === 'CUSTO' || cls === 'IMPOSTO') return true;

  return false;
}

/** Estado reduzido só com assinaturas PJ padrão (sintoma do bug). */
export function isSomenteAssinaturasPjPadrao(planos) {
  const list = (planos || []).filter((p) => !p.inativo);
  if (!list.length) return false;
  const ativos = list.filter((p) => isPlanoContasPJ(p));
  if (ativos.length !== list.length) return false;
  const descs = new Set(ativos.map((p) => String(p.descricao || '').trim().toLowerCase()));
  return (
    descs.has('receitas operacionais') &&
    descs.has('despesas administrativas') &&
    descs.size <= 4
  );
}

export function descricaoKey(desc) {
  return String(desc || '').trim().toLowerCase();
}

export function dedupePlanosById(planos) {
  const out = [];
  const seen = new Set();
  for (const p of planos || []) {
    if (!p?.id || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

/**
 * Seleciona planoContas para perfil PF:
 * - mantém categorias PF;
 * - mantém PJ só se referenciadas por lançamento;
 * - se só restarem PJ padrão, injeta PF histórico + defaults.
 */
export function selectPlanoContasForPf(merged, empresas, lancamentos, defaultCategoriasPF) {
  const usedIds = new Set(
    (lancamentos || []).map((l) => l.planoId).filter(Boolean)
  );

  const pfFromFisicaSlots = (empresas || [])
    .filter((e) => e.tipo === 'fisica')
    .flatMap((e) => e.planoContas || [])
    .filter((p) => !isPlanoContasPJ(p));

  const pfMerged = (merged || []).filter((p) => !isPlanoContasPJ(p));
  const pjReferenced = (merged || []).filter(
    (p) => isPlanoContasPJ(p) && usedIds.has(p.id)
  );

  let result = dedupePlanosById([...pfFromFisicaSlots, ...pfMerged, ...pjReferenced]);

  const somentePj = isSomenteAssinaturasPjPadrao(result.length ? result : merged);
  const semPf = !result.some((p) => !isPlanoContasPJ(p));

  const injectDefaults = () => {
    const defaults = defaultCategoriasPF();
    const byDesc = new Map(result.map((p) => [descricaoKey(p.descricao), p]));
    for (const d of defaults) {
      const k = descricaoKey(d.descricao);
      if (!byDesc.has(k)) {
        result.push(d);
        byDesc.set(k, d);
      }
    }
    result = result.filter(
      (p) => !isPlanoContasPJ(p) || usedIds.has(p.id)
    );
  };

  const pfCount = result.filter((p) => !isPlanoContasPJ(p)).length;
  if (semPf || somentePj || (pfCount > 0 && pfCount < 4)) {
    injectDefaults();
  }

  return dedupePlanosById(result);
}
