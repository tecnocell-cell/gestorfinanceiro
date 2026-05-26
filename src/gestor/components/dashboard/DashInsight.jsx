import { memo } from "react";
import { Sparkles } from "../icons.jsx";

/** Insight automático — texto derivado dos dados já carregados (sem API nova). */
function DashInsight({ message, tone = "neutral" }) {
  if (!message) return null;
  return (
    <div className={`dash-insight dash-insight--${tone}`} role="status">
      <span className="dash-insight-icon" aria-hidden>
        <Sparkles size={16} strokeWidth={1.75} />
      </span>
      <p className="dash-insight-text">{message}</p>
    </div>
  );
}

export default memo(DashInsight);
