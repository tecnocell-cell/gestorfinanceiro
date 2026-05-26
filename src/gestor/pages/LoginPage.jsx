import { useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import { css } from "../styles.js";
import { AlertTriangle } from "../components/icons.jsx";

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
      <div className="login-card">
        <div className="login-header">
          <div className="login-brand">CenterTech · SaaS</div>
          <div className="login-logo">CT</div>
          <h1 className="login-title">Gestor Financeiro</h1>
          <p className="login-subtitle">Entre com suas credenciais de acesso</p>
        </div>

        <div className="login-body">
          <form className="auth-form-fill" onSubmit={handleSubmit}>
            <div className="auth-form-fields">
              <div className="form-group">
                <label className="form-label">E-mail</label>
                <input
                  className="form-input" type="email" placeholder="voce@email.com"
                  value={form.email} onChange={e => set("email", e.target.value)}
                  required autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Senha</label>
                <input
                  className="form-input" type="password" placeholder="••••••••"
                  value={form.senha} onChange={e => set("senha", e.target.value)}
                  required minLength={6}
                />
              </div>
            </div>

            <div className="auth-form-actions">
              {error && (
                <div className="login-error">
                  <AlertTriangle size={16} strokeWidth={2} aria-hidden />
                  <span>{error}</span>
                  {needsVerify && onRegister && (
                    <div style={{ marginTop: 8 }}>
                      <button type="button" className="login-link-btn" onClick={onRegister}>
                        Inserir código de verificação
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button type="submit" disabled={loading} className="login-submit">
                {loading ? "Aguardando…" : "Entrar"}
              </button>
            </div>
          </form>

          <p className="login-footer">
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
