import { X, Plus, ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from "./icons.jsx";

const SIZE_CLASS = {
  sm: "modal-shell--sm",
  md: "modal-shell--md",
  lg: "modal-shell--lg",
  xl: "modal-shell--xl",
};

const TONE_ICON = {
  entrada: ArrowUpRight,
  receita: ArrowUpRight,
  saida: ArrowDownLeft,
  despesa: ArrowDownLeft,
  transferencia: ArrowLeftRight,
  meta: Plus,
  conta: Plus,
  recorrencia: Plus,
  categoria: Plus,
  neutral: Plus,
};

export function modalToneFromTipo(tipo, isPF) {
  if (tipo === "Entrada") return isPF ? "receita" : "entrada";
  if (tipo === "Saida") return isPF ? "despesa" : "saida";
  if (tipo === "Transferencia") return "transferencia";
  if (tipo === "Receita") return "receita";
  if (tipo === "Despesa") return "despesa";
  return "neutral";
}

export function ModalShell({
  onClose,
  title,
  subtitle,
  tone = "neutral",
  size = "lg",
  children,
  footer,
  icon: IconOverride,
}) {
  const Icon = IconOverride || TONE_ICON[tone] || Plus;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
      role="presentation"
    >
      <div
        className={`modal modal-shell ${SIZE_CLASS[size] || SIZE_CLASS.lg} modal-shell--${tone}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-shell-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={`modal-hero modal-hero--${tone}`}>
          <div className="modal-hero-main">
            <span className="modal-hero-icon" aria-hidden>
              <Icon size={20} strokeWidth={2} />
            </span>
            <div className="modal-hero-text">
              <h2 id="modal-shell-title" className="modal-hero-title">{title}</h2>
              {subtitle && <p className="modal-hero-sub">{subtitle}</p>}
            </div>
          </div>
          <button type="button" className="modal-hero-close" onClick={onClose} aria-label="Fechar">
            <X size={18} strokeWidth={2} />
          </button>
        </header>

        <div className="modal-body modal-body--premium">{children}</div>

        {footer}
      </div>
    </div>
  );
}

export function ModalSection({ label, children, className = "" }) {
  return (
    <section className={`modal-panel ${className}`.trim()}>
      {label && <div className="modal-panel-label">{label}</div>}
      <div className="modal-panel-body">{children}</div>
    </section>
  );
}

export function ModalFooter({
  onClose,
  onSave,
  saveLabel = "Salvar",
  cancelLabel = "Cancelar",
  loading = false,
  disabled = false,
  submitType = "button",
  formId,
}) {
  const busy = loading || disabled;
  return (
    <footer className="modal-footer modal-footer--premium">
      <button type="button" className="modal-btn modal-btn--ghost" onClick={onClose} disabled={loading}>
        {cancelLabel}
      </button>
      <button
        type={submitType}
        className="modal-btn modal-btn--primary"
        onClick={submitType === "button" ? onSave : undefined}
        form={formId}
        disabled={busy}
      >
        {loading ? "Salvando…" : saveLabel}
      </button>
    </footer>
  );
}

export function ModalGrid({ cols = 2, children, className = "" }) {
  const colClass = cols === 3 ? "modal-grid--3" : cols === 1 ? "modal-grid--1" : "modal-grid--2";
  return <div className={`modal-grid ${colClass} ${className}`.trim()}>{children}</div>;
}

export function ModalField({ label, required, hint, children, className = "" }) {
  return (
    <div className={`modal-field ${className}`.trim()}>
      {label && (
        <label className="modal-field-label">
          {label}
          {required && <span className="modal-field-req" aria-hidden> *</span>}
        </label>
      )}
      {children}
      {hint && <p className="modal-field-hint">{hint}</p>}
    </div>
  );
}

/**
 * Seletor de tipo — pills visuais (substitui ou complementa o &lt;select&gt;).
 * options: [{ value, label }]
 */
export function ModalTipoPills({ value, onChange, options, ariaLabel = "Tipo" }) {
  return (
    <div className="modal-tipo-pills" role="radiogroup" aria-label={ariaLabel}>
      {options.map((opt) => {
        const active = value === opt.value;
        const tone =
          opt.value === "Entrada" || opt.value === "Receita"
            ? "in"
            : opt.value === "Saida" || opt.value === "Despesa"
              ? "out"
              : opt.value === "Transferencia"
                ? "tr"
                : "neutral";
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={`modal-tipo-pill modal-tipo-pill--${tone}${active ? " is-active" : ""}`}
            onClick={() => onChange(opt.value)}
          >
            <span className="modal-tipo-pill-icon" aria-hidden>
              {tone === "in" && <ArrowUpRight size={16} strokeWidth={2.25} />}
              {tone === "out" && <ArrowDownLeft size={16} strokeWidth={2.25} />}
              {tone === "tr" && <ArrowLeftRight size={16} strokeWidth={2.25} />}
            </span>
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
