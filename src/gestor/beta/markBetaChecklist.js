import { betaApi } from "../api.js";

let betaModeCache = null;

export async function isBetaModeActive() {
  if (betaModeCache != null) return betaModeCache;
  try {
    const cfg = await betaApi.config();
    betaModeCache = !!cfg.betaMode;
    return betaModeCache;
  } catch {
    return false;
  }
}

/** Marca item do checklist (pdf, DRE, plano) sem bloquear a UI. */
export async function markBetaChecklistItem(itemKey) {
  try {
    if (!(await isBetaModeActive())) return;
    await betaApi.markChecklist(itemKey);
  } catch {
    /* ignore */
  }
}

export function resetBetaModeCache() {
  betaModeCache = null;
}
