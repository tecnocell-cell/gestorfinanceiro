import { memo } from "react";

/** Mini gráfico decorativo — apenas visual, sem eixos. */
function Sparkline({ data = [], tone = "neutral", width = 72, height = 28 }) {
  const values = data.filter((n) => Number.isFinite(n));
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const points = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * w;
      const y = pad + h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      className={`sparkline sparkline--${tone}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
    >
      <polyline points={points} fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default memo(Sparkline);
