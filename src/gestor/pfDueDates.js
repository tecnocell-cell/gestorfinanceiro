/** Utilitários de vencimento — PF */

export function parseLocalDate(iso) {
  if (!iso) return null;
  const d = new Date(iso.includes("T") ? iso : `${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function daysBetween(from, to) {
  const a = startOfDay(from).getTime();
  const b = startOfDay(to).getTime();
  return Math.round((b - a) / 86400000);
}

export function isLancamentoPago(l) {
  if (l.pago === true) return true;
  if (l.pago === false) return false;
  if (l.consiliado) return true;
  const due = parseLocalDate(l.vencimento || l.data);
  if (!due) return true;
  return due <= startOfDay(new Date());
}

export function getDueDate(l) {
  return l.vencimento || l.data;
}

/** Situação visual do lançamento PF: entrada | pago | vencida | proximo | pendente | neutral */
export function getLancamentoSituacao(l, windowDays = 3) {
  if (l.tipo === "Entrada") return "entrada";
  if (l.tipo !== "Saida") return "neutral";

  if (isLancamentoPago(l)) return "pago";

  const due = parseLocalDate(getDueDate(l));
  if (!due) return "pendente";

  const dias = daysBetween(startOfDay(new Date()), due);
  if (dias < 0) return "vencida";
  if (dias <= windowDays) return "proximo";
  return "pendente";
}

/** Despesas pendentes com vencimento em até `windowDays` dias (inclui atrasadas) */
export function getPendingDueItems(lancamentos, planoContas, windowDays = 3) {
  const today = startOfDay(new Date());
  const catMap = Object.fromEntries((planoContas || []).map((p) => [p.id, p.descricao]));

  return (lancamentos || [])
    .filter((l) => l.tipo === "Saida" && !isLancamentoPago(l))
    .map((l) => {
      const due = parseLocalDate(getDueDate(l));
      if (!due) return null;
      const dias = daysBetween(today, due);
      if (dias > windowDays) return null;
      return {
        id: l.id,
        descricao: l.historico || catMap[l.planoId] || "Despesa",
        vencimento: getDueDate(l),
        valor: l.valor,
        diasRestantes: dias,
        atrasado: dias < 0,
        hoje: dias === 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => parseLocalDate(a.vencimento) - parseLocalDate(b.vencimento));
}

export function playDueAlertSound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.36);
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc2.connect(g2);
      g2.connect(ctx.destination);
      osc2.frequency.value = 660;
      osc2.type = "sine";
      g2.gain.setValueAtTime(0.0001, ctx.currentTime);
      g2.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + 0.02);
      g2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      osc2.start(ctx.currentTime);
      osc2.stop(ctx.currentTime + 0.32);
    }, 380);
  } catch {
    /* autoplay pode ser bloqueado — popup visual permanece */
  }
}
