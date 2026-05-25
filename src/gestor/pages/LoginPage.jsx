import { useState } from "react";
import { useAuth } from "../AuthContext.jsx";

export default function LoginPage() {
  const { login, loading, error, clearError } = useAuth();
  const [form, setForm] = useState({ email: "", senha: "" });
  const set = (k, v) => { clearError(); setForm(p => ({ ...p, [k]: v })); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await login(form.email, form.senha);
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", padding: 20,
      background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 50%, #f0f9ff 100%)",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <div style={{
        width: "100%", maxWidth: 400,
        background: "#fff", borderRadius: 20, overflow: "hidden",
        boxShadow: "0 24px 60px rgba(15,23,42,0.13), 0 0 0 1px rgba(15,23,42,0.04)",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #10b981 0%, #0d9488 100%)",
          padding: "40px 36px 32px", textAlign: "center",
        }}>
          <div style={{
            width: 60, height: 60, borderRadius: 18, margin: "0 auto 18px",
            background: "rgba(255,255,255,0.18)", backdropFilter: "blur(8px)",
            border: "1.5px solid rgba(255,255,255,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em",
          }}>GF</div>
          <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.03em" }}>
            Gestor Financeiro
          </h1>
          <p style={{ color: "rgba(255,255,255,0.72)", fontSize: 13, margin: 0 }}>
            Entre com suas credenciais de acesso
          </p>
        </div>

        {/* Form */}
        <div style={{ padding: "36px 36px 40px" }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 18 }}>
              <label style={lbl}>E-mail</label>
              <input
                style={inp} type="email" placeholder="voce@email.com"
                value={form.email} onChange={e => set("email", e.target.value)}
                required autoFocus
                onFocus={e => e.target.style.borderColor = "#10b981"}
                onBlur={e => e.target.style.borderColor = "#e2e8f0"}
              />
            </div>

            <div style={{ marginBottom: 28 }}>
              <label style={lbl}>Senha</label>
              <input
                style={inp} type="password" placeholder="••••••••"
                value={form.senha} onChange={e => set("senha", e.target.value)}
                required minLength={6}
                onFocus={e => e.target.style.borderColor = "#10b981"}
                onBlur={e => e.target.style.borderColor = "#e2e8f0"}
              />
            </div>

            {error && (
              <div style={{
                background: "#fef2f2", border: "1px solid #fecaca",
                borderRadius: 10, padding: "11px 14px",
                color: "#dc2626", fontSize: 13, marginBottom: 18,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ fontSize: 16 }}>⚠</span> {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: "100%", padding: "14px", borderRadius: 12, border: "none",
              background: loading ? "#94a3b8" : "linear-gradient(135deg, #10b981, #0d9488)",
              color: "#fff", fontWeight: 700, fontSize: 15,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit", letterSpacing: "-0.01em",
              boxShadow: loading ? "none" : "0 4px 16px rgba(16,185,129,0.4)",
              transition: "all 0.15s",
            }}>
              {loading ? "Aguardando…" : "Entrar"}
            </button>
          </form>

          <p style={{
            textAlign: "center", fontSize: 12, color: "#cbd5e1",
            marginTop: 24, marginBottom: 0, lineHeight: 1.6,
          }}>
            Não tem acesso? Solicite ao administrador do sistema.
          </p>
        </div>
      </div>
    </div>
  );
}

const lbl = {
  display: "block", fontSize: 11, fontWeight: 700,
  textTransform: "uppercase", letterSpacing: "0.07em",
  color: "#64748b", marginBottom: 7,
};

const inp = {
  width: "100%", padding: "12px 14px", borderRadius: 10,
  border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none",
  fontFamily: "inherit", color: "#0f172a", background: "#f8fafc",
  boxSizing: "border-box", transition: "border-color 0.15s",
};
