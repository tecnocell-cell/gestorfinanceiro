import { memo } from "react";

/**
 * EmptyState — componente reutilizável para estados vazios.
 * Aceita emoji (string) ou componente Lucide via prop `icon`.
 */
function EmptyState({ icon = "📊", title, description, tone = "neutral", action, hint }) {
  const isStringIcon = typeof icon === "string";
  const IconComp = isStringIcon ? null : icon;

  return (
    <div className={`dash-empty-state dash-empty-state--${tone}`} role="status">
      <div className="dash-empty-state-bubble" aria-hidden>
        {IconComp ? (
          <span className="dash-empty-state-icon dash-empty-state-icon--lucide">
            <IconComp size={30} strokeWidth={1.65} />
          </span>
        ) : (
          <span className="dash-empty-state-icon">{icon}</span>
        )}
      </div>
      {title && <div className="dash-empty-state-title">{title}</div>}
      {description && <div className="dash-empty-state-desc">{description}</div>}
      {hint && <div className="dash-empty-state-hint">{hint}</div>}
      {action && <div className="dash-empty-state-action">{action}</div>}
    </div>
  );
}

export default memo(EmptyState);
