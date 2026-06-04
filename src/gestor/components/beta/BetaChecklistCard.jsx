import { useEffect, useState } from "react";
import { betaApi } from "../../api.js";
import { useBetaMode } from "../../hooks/useBetaMode.js";

export default function BetaChecklistCard({ onNavigate }) {
  const { betaMode, loading: betaLoading } = useBetaMode();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!betaMode) return;
    betaApi
      .checklist()
      .then((r) => setData(r.checklist))
      .catch((e) => setErr(e.message));
  }, [betaMode]);

  if (betaLoading || !betaMode || !data) return null;
  if (err) return null;

  const pct = data.percent ?? 0;

  return (
    <div className="card beta-checklist-card">
      <div className="beta-checklist-head">
        <div>
          <h3 className="beta-checklist-title">Checklist beta</h3>
          <p className="beta-checklist-sub">
            {data.done} de {data.total} concluídos ({pct}%)
          </p>
        </div>
        <div className="beta-checklist-ring" aria-hidden>
          <span>{pct}%</span>
        </div>
      </div>
      <ul className="beta-checklist-list">
        {data.items.map((item) => (
          <li
            key={item.key}
            className={`beta-checklist-item${item.done ? " beta-checklist-item--done" : ""}`}
          >
            <span className="beta-checklist-check" aria-hidden>
              {item.done ? "✓" : "○"}
            </span>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
      {pct < 100 && onNavigate && (
        <p className="beta-checklist-hint">
          Use o menu para completar os itens pendentes. Dúvidas?{" "}
          <button
            type="button"
            className="btn-link"
            onClick={() => onNavigate("ajuda")}
          >
            Central de ajuda
          </button>
        </p>
      )}
    </div>
  );
}
