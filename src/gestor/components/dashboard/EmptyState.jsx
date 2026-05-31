import { memo } from "react";

/**
 * EmptyState — componente reutilizável para estados vazios "bonitos".
 * Etapa 4.1: visual mais elegante com gradiente sutil e hint opcional.
 */
function EmptyState({ icon = "📊", title, description, tone = "neutral", action, hint }) {
  return (
    <div className={`dash-empty-state dash-empty-state--${tone}`} role="status">
      <div className="dash-empty-state-bubble" aria-hidden>
        <span className="dash-empty-state-icon">{icon}</span>
      </div>
      {title && <div className="dash-empty-state-title">{title}</div>}
      {description && <div className="dash-empty-state-desc">{description}</div>}
      {hint && <div className="dash-empty-state-hint">{hint}</div>}
      {action && <div className="dash-empty-state-action">{action}</div>}
    </div>
  );
}

export default memo(EmptyState);
