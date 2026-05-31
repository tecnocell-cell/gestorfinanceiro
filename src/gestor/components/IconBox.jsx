import { memo } from "react";

/** Ícone dentro de card KPI/resumo (.pp-summary-icon) */
export const SummaryIcon = memo(function SummaryIcon({ icon: Icon, size = 15, className = "" }) {
  if (!Icon) return null;
  return (
    <div className={`pp-summary-icon${className ? ` ${className}` : ""}`} aria-hidden>
      <Icon size={size} strokeWidth={2} />
    </div>
  );
});

/** Ícone em empty states (.pp-empty-icon) */
export const EmptyIcon = memo(function EmptyIcon({ icon: Icon, size = 28, className = "" }) {
  if (!Icon) return null;
  return (
    <div className={`pp-empty-icon${className ? ` ${className}` : ""}`} aria-hidden>
      <Icon size={size} strokeWidth={1.65} />
    </div>
  );
});

/** Título de widget com ícone Lucide inline */
export const WidgetTitle = memo(function WidgetTitle({ icon: Icon, children }) {
  return (
    <div className="widget-title-row">
      {Icon && (
        <span className="widget-title-icon" aria-hidden>
          <Icon size={15} strokeWidth={2} />
        </span>
      )}
      <span>{children}</span>
    </div>
  );
});
