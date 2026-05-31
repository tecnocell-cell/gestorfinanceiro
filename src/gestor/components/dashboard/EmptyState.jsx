import { memo } from "react";

/**
 * EmptyState — componente reutilizável para estados vazios "bonitos".
 * Usado nos widgets do Dashboard V2 (Etapa 4).
 */
function EmptyState({ icon = "📊", title, description, tone = "neutral", action }) {
  return (
    <div className={`dash-empty-state dash-empty-state--${tone}`} role="status">
      <div className="dash-empty-state-icon" aria-hidden>{icon}</div>
      {title && <div className="dash-empty-state-title">{title}</div>}
      {description && <div className="dash-empty-state-desc">{description}</div>}
      {action && <div className="dash-empty-state-action">{action}</div>}
    </div>
  );
}

export default memo(EmptyState);
