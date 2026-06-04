import { useEffect, useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import { empresaApi } from "../api.js";
import { css } from "../styles.js";
import LoginPage from "./LoginPage.jsx";

function getInviteTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("token") || params.get("aceitar_convite") || "";
}

export default function AcceptInvitePage() {
  const { token: authToken, setSession, login } = useAuth();
  const [inviteToken] = useState(() => getInviteTokenFromUrl());
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    if (!inviteToken) {
      setError("Link de convite inválido.");
      setLoading(false);
      return;
    }
    empresaApi
      .conviteInfo(inviteToken)
      .then((d) => setPreview(d.convite))
      .catch((e) => setError(e.message || "Convite não encontrado."))
      .finally(() => setLoading(false));
  }, [inviteToken]);

  const accept = async () => {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const data = await empresaApi.aceitarConvite(inviteToken);
      setMsg(`Você entrou na equipe de ${data.empresaNome || preview?.empresaNome || "empresa"}.`);
      window.history.replaceState(null, "", "/");
      setTimeout(() => {
        window.location.href = "/";
      }, 1200);
    } catch (e) {
      setError(e.message || "Não foi possível aceitar o convite.");
    } finally {
      setBusy(false);
    }
  };

  if (!authToken) {
    if (showLogin) {
      return (
        <LoginPage onRegister={() => setShowLogin(false)} />
      );
    }
    return (
      <>
        <style>{css}</style>
        <div className="auth-screen">
          <div className="auth-card" style={{ maxWidth: 440 }}>
            <h1 style={{ fontSize: 20, marginBottom: 8 }}>Convite para equipe</h1>
            {loading && <p>Carregando convite…</p>}
            {preview && (
              <p style={{ fontSize: 14, color: "var(--muted-foreground)" }}>
                Empresa: <strong>{preview.empresaNome}</strong>
                <br />
                Perfil: <strong>{preview.perfil}</strong>
                <br />
                E-mail convidado: {preview.emailConvidado}
              </p>
            )}
            {error && <div className="login-error" style={{ marginTop: 12 }}>{error}</div>}
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 16 }}
              onClick={() => setShowLogin(true)}
              disabled={!preview?.valid}
            >
              Entrar para aceitar
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{css}</style>
      <div className="auth-screen">
        <div className="auth-card" style={{ maxWidth: 440 }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Aceitar convite</h1>
          {loading && <p>Carregando…</p>}
          {preview && (
            <>
              <p style={{ fontSize: 14 }}>
                Você foi convidado para <strong>{preview.empresaNome}</strong> como{" "}
                <strong>{preview.perfil}</strong>.
              </p>
              {!preview.valid && (
                <p style={{ color: "var(--danger)", fontSize: 13 }}>
                  {preview.accepted ? "Convite já utilizado." : preview.expired ? "Convite expirado." : "Convite inválido."}
                </p>
              )}
            </>
          )}
          {error && <div className="login-error" style={{ marginTop: 12 }}>{error}</div>}
          {msg && <p style={{ color: "var(--green-dark)", fontSize: 13 }}>{msg}</p>}
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 16 }}
            disabled={busy || !preview?.valid}
            onClick={accept}
          >
            {busy ? "Aceitando…" : "Aceitar e entrar"}
          </button>
        </div>
      </div>
    </>
  );
}

export function isAcceptInviteRoute() {
  const path = window.location.pathname || "";
  return path.includes("aceitar-convite");
}
