import { memo } from "react";
import Sparkline from "./Sparkline.jsx";
import { TrendIcon } from "../icons.jsx";

/**
 * KPI premium — Lucide, sparkline opcional, badge de tendência.
 * Etapa 4 / 4.1:
 *  - modo `compact` mais denso porém respirável
 *  - melhor hierarquia ícone / sparkline / título / valor / sub
 *  - faixa lateral de cor por tom (success / danger / warning / default)
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
        {sparkline?.length >= 2 && (
          <Sparkline data={sparkline} tone={sparkTone} width={compact ? 56 : 80} height={compact ? 22 : 32} />
        )}
      </div>
      <div className={`kpi-v2-value ${valueClass}`}>{value}</div>
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
