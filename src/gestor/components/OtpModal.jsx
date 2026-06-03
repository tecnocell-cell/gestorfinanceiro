import { useCallback, useEffect, useMemo, useState } from "react";

const OTP_LEN = 6;

function formatCountdown(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Modal reutilizável para verificação OTP (6 dígitos).
 */
export default function OtpModal({
  open,
  title = "Confirme com o código",
  subtitle,
  otpId,
  expiresAt,
  ttlMinutes = 10,
  aviso,
  destinoMascarado,
  canal,
  tipo,
  email,
  token,
  onVerify,
  onResend,
  onClose,
  verifyLabel = "Confirmar",
  busy = false,
  error = "",
}) {
  const [digits, setDigits] = useState(Array(OTP_LEN).fill(""));
  const [localError, setLocalError] = useState("");
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(ttlMinutes * 60);

  const codigo = useMemo(() => digits.join(""), [digits]);

  useEffect(() => {
    if (!open) {
      setDigits(Array(OTP_LEN).fill(""));
      setLocalError("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const end = expiresAt ? new Date(expiresAt).getTime() : Date.now() + ttlMinutes * 60 * 1000;
    const tick = () => {
      const left = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setSecondsLeft(left);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [open, expiresAt, ttlMinutes]);

  const handleDigitChange = (index, value) => {
    const v = value.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = v;
      return next;
    });
    if (v && index < OTP_LEN - 1) {
      document.getElementById(`otp-digit-${index + 1}`)?.focus();
    }
  };

  const handlePaste = (e) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LEN);
    if (!text) return;
    e.preventDefault();
    setDigits(text.padEnd(OTP_LEN, "").split("").slice(0, OTP_LEN));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");
    if (codigo.length !== OTP_LEN) {
      setLocalError("Informe os 6 dígitos.");
      return;
    }
    if (secondsLeft <= 0) {
      setLocalError("Código expirado. Solicite um novo.");
      return;
    }
    try {
      await onVerify({ otp_id: otpId, codigo, tipo, email, token });
    } catch (err) {
      setLocalError(err.message || "Código inválido.");
    }
  };

  const handleResend = async () => {
    if (!onResend) return;
    setResending(true);
    setLocalError("");
    try {
      await onResend();
    } catch (err) {
      setLocalError(err.message || "Falha ao reenviar.");
    } finally {
      setResending(false);
    }
  };

  if (!open) return null;

  const displayError = error || localError;
  const expired = secondsLeft <= 0;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          {onClose && (
            <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">
              ×
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {subtitle && (
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "0 0 12px" }}>
              {subtitle}
            </p>
          )}
          {(destinoMascarado || canal) && (
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "0 0 8px" }}>
              Enviado para {destinoMascarado || "seu contato"} via{" "}
              {canal === "whatsapp" ? "WhatsApp" : "e-mail"}
            </p>
          )}
          {aviso && (
            <div
              style={{
                fontSize: 12,
                color: "var(--amber-dark, #b45309)",
                marginBottom: 12,
                padding: "8px 10px",
                borderRadius: 8,
                background: "oklch(0.98 0.02 85)",
              }}
            >
              {aviso}
            </div>
          )}

          <div
            className="otp-digit-row"
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "center",
              margin: "16px 0",
            }}
            onPaste={handlePaste}
          >
            {digits.map((d, i) => (
              <input
                key={i}
                id={`otp-digit-${i}`}
                className="form-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                value={d}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                style={{
                  width: 44,
                  height: 48,
                  textAlign: "center",
                  fontSize: 20,
                  fontWeight: 700,
                  padding: 0,
                }}
                aria-label={`Dígito ${i + 1}`}
              />
            ))}
          </div>

          <p
            style={{
              textAlign: "center",
              fontSize: 12,
              color: expired ? "var(--danger-fg, #b91c1c)" : "var(--muted-foreground)",
              marginBottom: 12,
            }}
          >
            {expired ? "Código expirado" : `Expira em ${formatCountdown(secondsLeft)}`}
          </p>

          {displayError && (
            <div className="login-error" style={{ marginBottom: 12 }}>
              <span>{displayError}</span>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy || expired || codigo.length !== OTP_LEN}
            >
              {busy ? "Validando…" : verifyLabel}
            </button>
            {onResend && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={resending}
                onClick={handleResend}
              >
                {resending ? "Reenviando…" : "Reenviar código"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
