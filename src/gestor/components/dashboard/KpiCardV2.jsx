import { memo } from "react";

/**
 * KpiCardV2 — card de KPI premium para o Dashboard V2.
 * Roda sobre fundo escuro (hero section).
 *
 * Props:
 *  icon       string  emoji / símbolo
 *  label      string  rótulo pequeno
 *  value      string  valor já formatado
 *  sub        string? texto secundário
 *  valueClass string? "danger" | "success" | "warning" | ""
 *  trend      { dir: "up"|"down"|"neutral", label: string }?
 *  delay      number? delay da animação (ms)
 *  loading    bool?   mostra skeleton
 */
function KpiCardV2({ icon, label, value, sub, valueClass = "", trend, delay = 0, loading = false }) {
  if (loading) {
    return (
      <div className="kpi-v2" style={{ animationDelay: `${delay}ms` }}>
        <div className="skeleton-pulse" style={{ width: 28, height: 28, borderRadius: 8, marginBottom: 8 }} />
        <div className="skeleton-pulse" style={{ width: "60%", height: 12, borderRadius: 4, marginBottom: 8 }} />
        <div className="skeleton-pulse" style={{ width: "80%", height: 24, borderRadius: 4 }} />
      </div>
    );
  }

  return (
    <div className="kpi-v2 dash-v2-fade-in" style={{ animationDelay: `${delay}ms` }}>
      <div className="kpi-v2-icon">{icon}</div>
      <div className="kpi-v2-label">{label}</div>
      <div className={`kpi-v2-value ${valueClass}`}>{value}</div>
      {sub && <div className="kpi-v2-sub">{sub}</div>}
      {trend && (
        <div className={`kpi-v2-trend ${trend.dir}`}>
          {trend.dir === "up" ? "↑" : trend.dir === "down" ? "↓" : "→"} {trend.label}
        </div>
      )}
    </div>
  );
}

export default memo(KpiCardV2);
