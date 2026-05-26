import { fmtBRL } from "../finance.js";

export default function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      <div className="chart-tooltip-rows">
        {payload.map((p, i) => (
          <div key={i} className="chart-tooltip-row">
            <span className="chart-tooltip-dot" style={{ background: p.color }} aria-hidden />
            <span className="chart-tooltip-name">{p.name}</span>
            <span className="chart-tooltip-value">
              {typeof p.value === "number" ? fmtBRL(p.value) : p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
