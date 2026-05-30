import { useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import { css } from "../styles.js";
import { AlertTriangle } from "../components/icons.jsx";
import { BrandLogo } from "../components/BrandLogo.jsx";

export default function LoginPage({ onRegister }) {
  const { login, loading, error, clearError } = useAuth();
  const [form, setForm] = useState({ email: "", senha: "" });
  const [needsVerify, setNeedsVerify] = useState(false);
  const set = (k, v) => { clearError(); setNeedsVerify(false); setForm(p => ({ ...p, [k]: v })); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setNeedsVerify(false);
    const result = await login(form.email, form.senha);
    if (result?.needsVerification) setNeedsVerify(true);
  };

  return (
    <>
      <style>{css}</style>
      <div className="login-page">
      <div className="login-card" style={{ maxWidth: 380, height: "auto" }}>
        <div className="login-header" style={{ padding: "22px 28px 16px" }}>
          <div className="login-brand-logo-wrap">
            <BrandLogo variant="fluxiva" theme="dark" markSize={40} />
          </div>
          <p className="login-subtitle" style={{ marginTop: 6, fontSize: 13 }}>Entre com suas credenciais de acesso</p>
        </div>

        <div className="login-body" style={{ padding: "20px 28px 24px", flex: "0 0 auto" }}>
          <form className="auth-form-fill" style={{ flex: "0 0 auto" }} onSubmit={handleSubmit}>
            <div className="auth-form-fields" style={{ flex: "0 0 auto", justifyContent: "flex-start", gap: 12 }}>
              <div className="form-group" style={{ gap: 4 }}>
                <label className="form-label" style={{ fontSize: 13 }}>E-mail</label>
                <input
                  className="form-input" type="email" placeholder="voce@email.com"
                  style={{ height: 38, fontSize: 14 }}
                  value={form.email} onChange={e => set("email", e.target.value)}
                  required autoFocus
                />
              </div>

              <div className="form-group" style={{ gap: 4 }}>
                <label className="form-label" style={{ fontSize: 13 }}>Senha</label>
                <input
                  className="form-input" type="password" placeholder="••••••••"
                  style={{ height: 38, fontSize: 14 }}
                  value={form.senha} onChange={e => set("senha", e.target.value)}
                  required minLength={6}
                />
              </div>
            </div>

            <div className="auth-form-actions" style={{ marginTop: 16, paddingTop: 0 }}>
              {error && (
                <div className="login-error">
                  <AlertTriangle size={15} strokeWidth={2} aria-hidden />
                  <span>{error}</span>
                  {needsVerify && onRegister && (
                    <div style={{ marginTop: 6 }}>
                      <button type="button" className="login-link-btn" onClick={onRegister}>
                        Inserir código de verificação
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button type="submit" disabled={loading} className="login-submit" style={{ height: 40, fontSize: 14 }}>
                {loading ? "Aguardando…" : "Entrar"}
              </button>
            </div>
          </form>

          <p className="login-footer" style={{ marginTop: 14, paddingTop: 0, fontSize: 13 }}>
            Não tem conta?{" "}
            <button type="button" className="login-link-btn" onClick={onRegister}>
              Criar cadastro grátis
            </button>
          </p>
        </div>
      </div>
    </div>
    </>
  );
}
