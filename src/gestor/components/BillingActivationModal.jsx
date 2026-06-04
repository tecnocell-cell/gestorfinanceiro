import { PUBLIC_MESSAGES, SUPPORT_WHATSAPP_URL } from "../planRules.js";

export default function BillingActivationModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="billing-activation-title"
      onClick={onClose}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <h2 id="billing-activation-title" style={{ margin: "0 0 8px", fontSize: 18 }}>
          {PUBLIC_MESSAGES.checkoutModalTitle}
        </h2>
        <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--muted-foreground, #64748b)" }}>
          {PUBLIC_MESSAGES.checkoutModalBody}
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a
            href={SUPPORT_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            Falar com suporte (WhatsApp)
          </a>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
