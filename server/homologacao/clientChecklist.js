/**
 * Checklist guiado do cliente — Etapa 8.0
 */
import { query } from '../db.js';

export const RC_CLIENT_CHECKLIST_KEY = 'release_client_checklist_v1';

export const RC_ITEMS_PF = [
  { key: 'cadastro', label: 'Cadastro' },
  { key: 'login', label: 'Login' },
  { key: 'onboarding', label: 'Onboarding' },
  { key: 'lancamento', label: 'Lançamento' },
  { key: 'conta_paga', label: 'Conta paga' },
  { key: 'pdf', label: 'PDF exportado' },
  { key: 'plano_portal', label: 'Plano / portal do cliente' },
  { key: 'pix', label: 'Pagamento PIX' },
];

export const RC_ITEMS_PJ = [
  { key: 'cadastro', label: 'Cadastro empresa' },
  { key: 'cliente', label: 'Cliente' },
  { key: 'centro_custo', label: 'Centro de custo' },
  { key: 'dre', label: 'DRE' },
  { key: 'equipe', label: 'Equipe' },
  { key: 'integracao_pf_pj', label: 'Integração PF/PJ' },
  { key: 'pdf', label: 'PDF' },
  { key: 'pix', label: 'Pagamento PIX' },
];

async function readState() {
  const { rows } = await query(
    `SELECT value FROM system_config WHERE key = $1`,
    [RC_CLIENT_CHECKLIST_KEY]
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
    [RC_CLIENT_CHECKLIST_KEY, JSON.stringify(state)]
  );
}

export async function getClientChecklist() {
  const state = await readState();
  const mapSegment = (items, seg) =>
    items.map((item) => ({
      ...item,
      checked: Boolean(state[seg]?.[item.key]),
      checked_at: state[seg]?.[`${item.key}_at`] || null,
    }));

  const pf = mapSegment(RC_ITEMS_PF, 'pf');
  const pj = mapSegment(RC_ITEMS_PJ, 'pj');
  const total = pf.length + pj.length;
  const done = pf.filter((i) => i.checked).length + pj.filter((i) => i.checked).length;

  return {
    pf,
    pj,
    progress: { total, done, percent: total ? Math.round((done / total) * 100) : 0 },
  };
}

export async function setClientChecklistItem({ segment, key, checked, adminEmail }) {
  const seg = segment === 'pj' ? 'pj' : 'pf';
  const items = seg === 'pj' ? RC_ITEMS_PJ : RC_ITEMS_PF;
  if (!items.some((i) => i.key === key)) {
    return { ok: false, error: 'Item de checklist inválido.' };
  }
  const state = await readState();
  if (!state[seg]) state[seg] = {};
  state[seg][key] = checked;
  state[seg][`${key}_at`] = checked ? new Date().toISOString() : null;
  state[seg][`${key}_by`] = checked ? adminEmail || null : null;
  await writeState(state);
  return { ok: true, ...(await getClientChecklist()) };
}
