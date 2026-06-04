import { useState } from "react";
import { MessageSquare } from "../icons.jsx";
import BetaFeedbackModal from "./BetaFeedbackModal.jsx";

export default function BetaFeedbackFab({ currentPage }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="beta-feedback-fab"
        onClick={() => setOpen(true)}
        aria-label="Enviar feedback"
        title="Enviar feedback"
      >
        <MessageSquare size={20} strokeWidth={1.75} aria-hidden />
        <span className="beta-feedback-fab-label">Enviar feedback</span>
      </button>
      {open && (
        <BetaFeedbackModal
          tela={currentPage}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
