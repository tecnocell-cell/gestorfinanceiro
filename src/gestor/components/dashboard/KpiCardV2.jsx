import { memo } from "react";
import Sparkline from "./Sparkline.jsx";
import { TrendIcon } from "../icons.jsx";
import KpiValue from "./KpiValue.jsx";

/**
 * KPI premium — Lucide, sparkline opcional, delta comparativo, badge de tendência.
 *
 * Etapa 4.2:
 *  - Suporte a `delta` ({ pct, label, dir }) com badge inline tipo Stripe/Linear
 *  - Hierarquia mais firme: valor dominante, comparação logo abaixo, sub menor
 *  - Microtendência (sparkline) mantém leitura periférica
 *  - Sem novas regras de negócio — recebe deltas calculados pela página
 */
function KpiCardV2({
  icon: Icon,
  label,
  value,
  sub,
  valueClass = "",
  trend,
  sparkline,
  tone = "default",
  loading = false,
  compact = false,
  delta, // { pct: number, label?: string, dir?: 'up'|'down'|'flat', invert?: boolean }
}) {
  if (loading) {
    return (
      <div className={`kpi-v2${compact ? " kpi-v2--compact" : ""} kpi-v2--skeleton`}>
        <div className="skeleton-pulse" style={{ width: 32, height: 32, borderRadius: 10, marginBottom: 8 }} />
        <div className="skeleton-pulse" style={{ width: "55%", height: 10, borderRadius: 4, marginBottom: 6 }} />
        <div className="skeleton-pulse" style={{ width: "75%", height: 22, borderRadius: 4 }} />
      </div>
    );
  }

  const sparkTone = valueClass === "success" ? "success" : valueClass === "danger" ? "danger" : "neutral";

  // Resolve direção do delta. invert=true => up é ruim (ex.: despesas).
  let deltaCls = "flat";
  if (delta && Number.isFinite(delta.pct)) {
    const up = delta.pct > 0.0005;
    const down = delta.pct < -0.0005;
    if (up)   deltaCls = delta.invert ? "down" : "up";
    if (down) deltaCls = delta.invert ? "up"   : "down";
  }
  const deltaArrow = deltaCls === "up" ? "up" : deltaCls === "down" ? "down" : "flat";
  const deltaText  = delta && Number.isFinite(delta.pct)
    ? `${delta.pct > 0 ? "+" : ""}${(delta.pct * 100).toFixed(1)}%`
    : null;

  return (
    <div className={`kpi-v2${compact ? " kpi-v2--compact" : ""} kpi-v2--${tone} kpi-v2--${valueClass || "default"}`}>
      <span className="kpi-v2-accent" aria-hidden />
      <div className="kpi-v2-top">
        <div className="kpi-v2-icon-wrap" aria-hidden>
          {Icon ? <Icon size={compact ? 15 : 20} strokeWidth={1.85} /> : null}
        </div>
        <div className="kpi-v2-label-wrap">
          <div className="kpi-v2-label">{label}</div>
        </div>
        {/* sparkline apenas no modo full — no compact reduz densidade */}
        {!compact && sparkline?.length >= 2 && (
          <Sparkline data={sparkline} tone={sparkTone} width={80} height={32} />
        )}
      </div>
      <KpiValue className={valueClass} compact={compact}>{value}</KpiValue>
      {deltaText && (
        <div className={`kpi-v2-delta kpi-v2-delta--${deltaCls}`} title={delta.label || ""}>
          <span className="kpi-v2-delta-arrow"><TrendIcon dir={deltaArrow === "flat" ? null : deltaArrow} size={12} /></span>
          <span className="kpi-v2-delta-pct">{deltaText}</span>
          {delta.label && <span className="kpi-v2-delta-lbl">{delta.label}</span>}
        </div>
      )}
      {sub && <div className="kpi-v2-sub">{sub}</div>}
      {trend && !compact && (
        <div className={`kpi-v2-trend ${trend.dir}`}>
          <TrendIcon dir={trend.dir} size={13} />
          <span>{trend.label}</span>
        </div>
      )}
    </div>
  );
}

export default memo(KpiCardV2);
