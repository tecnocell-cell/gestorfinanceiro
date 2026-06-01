import { memo } from "react";

/** Comprimento do texto formatado — usado em --kpi-ch para escala fluida no CSS. */
export function kpiCharCount(value) {
  const s = value == null ? "" : String(value);
  /* Comprimento real: valores curtos (ex. R$ 15.000,00) ganham fonte maior; longos encolhem */
  return Math.max(10, s.length);
}

/**
 * Valor monetário em card KPI — hotfix overflow.
 * Escala via container query (cqi) + --kpi-ch (caracteres).
 */
function KpiValue({ children, className = "", compact = false }) {
  const text = children == null ? "" : String(children);
  const toneCls = className ? ` ${className}` : "";
  const wrapCls = `kpi-v2-value-wrap${compact ? " kpi-v2-value-wrap--compact" : ""}${toneCls}`;

  return (
    <div className={wrapCls.trim()} style={{ "--kpi-ch": kpiCharCount(text) }}>
      <div className={`kpi-v2-value${toneCls}`.trim()} title={text}>
        {children}
      </div>
    </div>
  );
}

export default memo(KpiValue);
