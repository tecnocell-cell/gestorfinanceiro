import { AlertTriangle } from "./icons.jsx";

const WARN_STYLE = {
  marginBottom: 16,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid oklch(0.85 0.06 85)",
  background: "oklch(0.98 0.02 85)",
  fontSize: 13,
  color: "var(--text, #0f172a)",
};

/**
 * Avisos de configuração do servidor (e-mail, WhatsApp, cobrança, Open Finance).
 * keys: email | whatsapp | billing | openFinance — omitir = mostrar todos pendentes
 */
export default function ConfigStatusBanner({ status, keys, compact = false }) {
  if (!status) return null;

  const checks = [
    keys?.includes("email") !== false &&
      !status.email?.configured && {
        key: "email",
        text: status.email?.message || "Envio de e-mail não configurado.",
      },
    keys?.includes("whatsapp") !== false &&
      !status.whatsapp?.configured && {
        key: "whatsapp",
        text: status.whatsapp?.message || "WhatsApp não configurado.",
      },
    keys?.includes("billing") !== false &&
      !status.billing?.configured && {
        key: "billing",
        text: status.billing?.message || "Cobrança real não configurada.",
      },
    keys?.includes("openFinance") !== false &&
      status.openFinance?.demoMode && {
        key: "openFinance",
        text: status.openFinance?.message || "Open Finance em modo demo.",
      },
  ].filter(Boolean);

  if (!checks.length) return null;

  if (compact) {
    return (
      <div style={WARN_STYLE}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <AlertTriangle size={16} strokeWidth={2} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            {checks.map((c) => (
              <div key={c.key}>{c.text}</div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {checks.map((c) => (
        <div key={c.key} style={WARN_STYLE}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 600, marginBottom: 4 }}>
            <AlertTriangle size={16} strokeWidth={2} aria-hidden />
            Aviso
          </div>
          <p style={{ margin: 0, color: "var(--muted-foreground, #475569)" }}>{c.text}</p>
        </div>
      ))}
    </>
  );
}
