import { fmtBRL } from "../finance.js";

export default function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e2e8f0",
      borderRadius: 10,
      padding: "10px 14px",
      fontFamily: "JetBrains Mono, monospace",
      fontSize: 12,
      boxShadow: "0 4px 16px rgba(15,23,42,0.08)",
    }}>
      <div style={{ color: "#475569", marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {typeof p.value === "number" ? fmtBRL(p.value) : p.value}
        </div>
      ))}
    </div>
  );
}
