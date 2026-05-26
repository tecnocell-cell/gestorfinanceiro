import { memo } from "react";

/**
 * ChartCardV2 — wrapper de card para gráficos no Dashboard V2.
 * Roda sobre fundo claro (seção abaixo do hero).
 */
function ChartCardV2({ title, sub, badge, children, height = 230, minHeight, className = "", style }) {
  return (
    <div className={`chart-card-v2${className ? ` ${className}` : ""}`} style={style}>
      <div className="chart-card-v2-header">
        <div>
          <div className="chart-card-v2-title">{title}</div>
          {sub && <div className="chart-card-v2-sub">{sub}</div>}
        </div>
        {badge && <div className="chart-card-v2-badge">{badge}</div>}
      </div>
      <div style={{ height: height ?? minHeight ?? 230 }}>
        {children}
      </div>
    </div>
  );
}

export default memo(ChartCardV2);
