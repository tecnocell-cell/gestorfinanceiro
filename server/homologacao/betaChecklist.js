/**
 * Checklist beta fechado — Etapa 7.5
 */
import { query } from '../db.js';

export const BETA_CHECKLIST_KEY = 'beta_homologacao_v1';

export const BETA_ITEMS_PF = [
  { key: 'cadastro', label: 'Cadastro e login' },
  { key: 'onboarding', label: 'Onboarding concluído' },
  { key: 'whatsapp', label: 'WhatsApp (conectar / número autorizado)' },
  { key: 'lancamento', label: 'Lançamento manual ou via WhatsApp' },
  { key: 'relatorio_pdf', label: 'Relatório PDF exportado' },
  { key: 'assinatura', label: 'Assinatura / checkout PIX' },
];

export const BETA_ITEMS_PJ = [
  { key: 'cadastro', label: 'Cadastro empresa' },
  { key: 'equipe', label: 'Convite e membro na equipe' },
  { key: 'cliente', label: 'Cliente / resultado por cliente' },
  { key: 'centro_custo', label: 'Centro de custo' },
  { key: 'dre', label: 'DRE' },
  { key: 'pdf', label: 'Relatório PDF' },
  { key: 'assinatura', label: 'Assinatura / checkout PIX' },
];

async function readState() {
  const { rows } = await query(
    `SELECT value FROM system_config WHERE key = $1`,
    [BETA_CHECKLIST_KEY]
  );
  if (!rows.length) return { pf: {}, pj: {} };
  try {
    const v = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
    return { pf: v.pf || {}, pj: v.pj || {} };
  } catch {
    return { pf: {}, pj: {} };
  }
}

async function writeState(state) {
  await query(
    `INSERT INTO system_config (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [BETA_CHECKLIST_KEY, JSON.stringify(state)]
  );
}

export async function getBetaHomologacao() {
  const state = await readState();
  const mapSegment = (items, seg) =>
    items.map((item) => ({
      ...item,
      checked: Boolean(state[seg]?.[item.key]),
      checked_at: state[seg]?.[`${item.key}_at`] || null,
    }));

  const pf = mapSegment(BETA_ITEMS_PF, 'pf');
  const pj = mapSegment(BETA_ITEMS_PJ, 'pj');
  const total = pf.length + pj.length;
  const done = pf.filter((i) => i.checked).length + pj.filter((i) => i.checked).length;

  return {
    pf,
    pj,
    progress: { total, done, percent: total ? Math.round((done / total) * 100) : 0 },
  };
}

export async function setBetaHomologacaoItem({ segment, key, checked, adminEmail }) {
  const seg = segment === 'pj' ? 'pj' : 'pf';
  const items = seg === 'pj' ? BETA_ITEMS_PJ : BETA_ITEMS_PF;
  if (!items.some((i) => i.key === key)) {
    return { ok: false, error: 'Item de checklist inválido.' };
  }
  const state = await readState();
  if (!state[seg]) state[seg] = {};
  state[seg][key] = checked;
  state[seg][`${key}_at`] = checked ? new Date().toISOString() : null;
  state[seg][`${key}_by`] = checked ? adminEmail || null : null;
  await writeState(state);
  return { ok: true, ...(await getBetaHomologacao()) };
}
