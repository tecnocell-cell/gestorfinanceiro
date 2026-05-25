import { useState } from "react";
import { useAuth } from "../AuthContext.jsx";

export default function LoginPage({ onLocalMode }) {
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
      background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 40%, #f0f9ff 100%)",
      backgroundImage: `
        radial-gradient(ellipse 80% 50% at 50% -20%, rgba(16,185,129,0.12), transparent),
        radial-gradient(ellipse 60% 40% at 100% 0%, rgba(13,148,136,0.08), transparent)
      `,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, width: "100%", maxWidth: 420,
        boxShadow: "0 24px 60px rgba(15,23,42,0.12), 0 0 0 1px rgba(15,23,42,0.04)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #10b981, #0d9488)",
          padding: "36px 36px 30px", textAlign: "center",
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: "rgba(255,255,255,0.2)", backdropFilter: "blur(4px)",
            border: "1px solid rgba(255,255,255,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px", fontSize: 24, fontWeight: 800, color: "#fff",
          }}>GF</div>
          <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.03em" }}>
            Gestor Financeiro
          </h1>
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, margin: "8px 0 0" }}>
            Entre com suas credenciais de acesso
          </p>
        </div>

        {/* Form */}
        <div style={{ padding: "32px 36px 36px" }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>E-mail</label>
              <input
                style={inp} type="email" placeholder="voce@email.com"
                value={form.email} onChange={e => set("email", e.target.value)}
                required autoFocus
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={lbl}>Senha</label>
              <input
                style={inp} type="password" placeholder="••••••••"
                value={form.senha} onChange={e => set("senha", e.target.value)}
                required minLength={6}
              />
            </div>

            {error && (
              <div style={{
                background: "rgba(225,29,72,0.07)", border: "1px solid rgba(225,29,72,0.2)",
                borderRadius: 10, padding: "10px 14px", color: "#be123c",
                fontSize: 13, marginBottom: 16,
              }}>⚠ {error}</div>
            )}

            <button type="submit" disabled={loading} style={{
              width: "100%", padding: "13px", borderRadius: 11, border: "none",
              background: loading ? "#94a3b8" : "linear-gradient(135deg, #10b981, #0d9488)",
              color: "#fff", fontWeight: 700, fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit", letterSpacing: "-0.01em",
              boxShadow: loading ? "none" : "0 4px 14px rgba(16,185,129,0.35)",
              transition: "all 0.15s",
            }}>
              {loading ? "Aguarde…" : "Entrar"}
            </button>
          </form>

          {/* Divisor */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0 16px" }}>
            <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
            <span style={{ fontSize: 12, color: "#cbd5e1" }}>ou</span>
            <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
          </div>

          {/* Modo local */}
          <button
            type="button" onClick={onLocalMode}
            style={{
              width: "100%", padding: "11px", borderRadius: 11,
              border: "1.5px solid #e2e8f0", background: "#f8fafc",
              color: "#475569", fontWeight: 600, fontSize: 14,
              cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#10b981"; e.currentTarget.style.color = "#0d9488"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#475569"; }}
          >
            💾 Usar sem conta (dados locais)
          </button>

          <p style={{ textAlign: "center", fontSize: 11, color: "#cbd5e1", marginTop: 20, marginBottom: 0, lineHeight: 1.6 }}>
            Não tem acesso? Solicite ao administrador do sistema.<br/>
            Dados em conta: armazenados com segurança em PostgreSQL.
          </p>
        </div>
      </div>
    </div>
  );
}

const lbl = {
  display: "block", fontSize: 11, fontWeight: 700,
  textTransform: "uppercase", letterSpacing: "0.06em",
  color: "#475569", marginBottom: 6,
};

const inp = {
  width: "100%", padding: "11px 14px", borderRadius: 10,
  border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none",
  fontFamily: "inherit", color: "#0f172a", background: "#fff",
  boxSizing: "border-box", transition: "border-color 0.15s",
};
