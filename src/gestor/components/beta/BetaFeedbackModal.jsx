import { useState } from "react";
import { betaApi } from "../../api.js";

const TIPOS = [
  ["bug", "Bug"],
  ["duvida", "Dúvida"],
  ["sugestao", "Sugestão"],
  ["elogio", "Elogio"],
];

export default function BetaFeedbackModal({ tela, onClose }) {
  const [tipo, setTipo] = useState("bug");
  const [mensagem, setMensagem] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await betaApi.sendFeedback({ tela, tipo, mensagem });
      setOk(true);
      setTimeout(onClose, 1400);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal beta-feedback-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header modal-header-forest">
          <h2 className="modal-title" style={{ color: "var(--primary-foreground)" }}>
            Enviar feedback
          </h2>
        </div>
        <form className="modal-body" onSubmit={submit}>
          {ok ? (
            <p className="admin-empty" style={{ color: "var(--success-fg)" }}>
              Obrigado! Seu feedback foi registrado.
            </p>
          ) : (
            <>
              <label className="form-label">Tipo</label>
              <select
                className="form-select"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
              >
                {TIPOS.map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>

              <label className="form-label" style={{ marginTop: 12 }}>Mensagem</label>
              <textarea
                className="form-input"
                rows={5}
                required
                minLength={3}
                placeholder="Descreva o que aconteceu ou sua sugestão…"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
              />

              {error && (
                <div className="alert alert-warn" style={{ marginTop: 12 }}>{error}</div>
              )}

              <div className="modal-footer" style={{ marginTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? "Enviando…" : "Enviar"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
