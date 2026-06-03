import { useCallback, useEffect, useState } from "react";
import { authApi } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { AlertTriangle } from "../components/icons.jsx";
import OtpModal from "../components/OtpModal.jsx";

function formatDateTime(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return "—";
  }
}

export default function SegurancaPage() {
  const { user } = useAuth();
  const [security, setSecurity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const [verifyToken, setVerifyToken] = useState("");
  const [sendingVerify, setSendingVerify] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [pwd, setPwd] = useState({ atual: "", nova: "", confirma: "" });
  const [changingPwd, setChangingPwd] = useState(false);
  const [otpModal, setOtpModal] = useState(null);
  const [otpBusy, setOtpBusy] = useState(false);
  const [telefone, setTelefone] = useState("");

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const data = await authApi.security();
      setSecurity(data);
    } catch (e) {
      setError(e.message || "Erro ao carregar segurança.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const params = new URLSearchParams(window.location.search);
    const t = params.get("verify_token");
    if (t) setVerifyToken(t);
  }, [load]);

  const handleResend = async () => {
    setMsg("");
    setError("");
    setSendingVerify(true);
    try {
      const data = await authApi.sendVerification();
      setMsg(data.message || "E-mail de verificação enviado.");
      if (data.dev_token) setVerifyToken(data.dev_token);
    } catch (e) {
      setError(e.message || "Falha ao enviar verificação.");
    } finally {
      setSendingVerify(false);
    }
  };

  const handleVerifyToken = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");
    setVerifying(true);
    try {
      await authApi.verifyEmail(verifyToken.trim());
      setMsg("E-mail verificado com sucesso.");
      setVerifyToken("");
      await load();
    } catch (err) {
      setError(err.message || "Token inválido.");
    } finally {
      setVerifying(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");
    if (pwd.nova.length < 6) {
      setError("Nova senha: mínimo 6 caracteres.");
      return;
    }
    if (pwd.nova !== pwd.confirma) {
      setError("Confirmação não confere com a nova senha.");
      return;
    }
    setChangingPwd(true);
    try {
      const sent = await authApi.otpSend({ tipo: "acao_sensivel", canal: "email" });
      setOtpModal({
        mode: "change_password",
        otp_id: sent.otp_id,
        expires_at: sent.expires_at,
        canal: sent.canal,
        destino_mascarado: sent.destino_mascarado,
        aviso: sent.aviso,
        ttl_minutes: sent.ttl_minutes,
      });
      setMsg("Enviamos um código para confirmar a alteração de senha.");
    } catch (err) {
      setError(err.message || "Não foi possível enviar o código.");
    } finally {
      setChangingPwd(false);
    }
  };

  const confirmChangePassword = async ({ otp_id, codigo }) => {
    setOtpBusy(true);
    try {
      await authApi.changePassword(pwd.atual, pwd.nova, otp_id, codigo);
      setMsg("Senha alterada com sucesso.");
      setPwd({ atual: "", nova: "", confirma: "" });
      setOtpModal(null);
    } finally {
      setOtpBusy(false);
    }
  };

  const handleVerifyPhone = async () => {
    setMsg("");
    setError("");
    if (!telefone.trim()) {
      setError("Informe o telefone para verificação.");
      return;
    }
    try {
      const sent = await authApi.otpSend({
        tipo: "verificar_telefone",
        canal: "whatsapp",
      });
      setOtpModal({
        mode: "verify_phone",
        otp_id: sent.otp_id,
        expires_at: sent.expires_at,
        canal: sent.canal,
        destino_mascarado: sent.destino_mascarado,
        aviso: sent.aviso,
        ttl_minutes: sent.ttl_minutes,
      });
      setMsg("Código enviado para verificação do telefone.");
    } catch (err) {
      setError(err.message || "Falha ao enviar código.");
    }
  };

  const confirmVerifyPhone = async ({ otp_id, codigo }) => {
    setOtpBusy(true);
    try {
      await authApi.otpVerify({ otp_id, codigo, tipo: "verificar_telefone" });
      setMsg("Telefone verificado com sucesso.");
      setOtpModal(null);
      await load();
    } finally {
      setOtpBusy(false);
    }
  };

  const resendOtp = async () => {
    if (!otpModal) return;
    const tipo = otpModal.mode === "verify_phone" ? "verificar_telefone" : "acao_sensivel";
    const data = await authApi.otpSend({ tipo, canal: otpModal.canal || "email" });
    setOtpModal((prev) => ({
      ...prev,
      otp_id: data.otp_id,
      expires_at: data.expires_at,
      canal: data.canal,
      destino_mascarado: data.destino_mascarado,
      aviso: data.aviso,
    }));
  };

  const verified = Boolean(security?.email_verificado);

  return (
    <div>
      {loading && <p style={{ fontSize: 13, color: "var(--muted)" }}>Carregando…</p>}

      {error && (
        <div className="login-error" style={{ marginBottom: 12 }}>
          <AlertTriangle size={15} strokeWidth={2} aria-hidden />
          <span>{error}</span>
        </div>
      )}
      {msg && (
        <div style={{ marginBottom: 12, fontSize: 13, color: "var(--green-dark)" }}>{msg}</div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Verificação de e-mail</div>
        <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
          Conta: <strong>{security?.email || user?.email}</strong>
        </p>
        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <div className="form-label">Status</div>
            <div style={{ fontSize: 14 }}>
              {verified ? (
                <span style={{ color: "var(--green-dark)" }}>Verificado</span>
              ) : (
                <span style={{ color: "var(--amber-dark, #b45309)" }}>Pendente</span>
              )}
            </div>
          </div>
          <div>
            <div className="form-label">Verificado em</div>
            <div style={{ fontSize: 14 }}>{formatDateTime(security?.email_verificado_em)}</div>
          </div>
        </div>
        {!verified && (
          <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={sendingVerify}
              onClick={handleResend}
            >
              {sendingVerify ? "Enviando…" : "Reenviar verificação"}
            </button>
          </div>
        )}
        {!verified && (
          <form onSubmit={handleVerifyToken} style={{ marginTop: 16 }}>
            <div className="form-group">
              <label className="form-label">Token de verificação (e-mail)</label>
              <input
                className="form-input"
                type="text"
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
                placeholder="Cole o token recebido por e-mail"
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={verifying || !verifyToken.trim()}>
              {verifying ? "Validando…" : "Confirmar e-mail"}
            </button>
          </form>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Último login</div>
        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <div className="form-label">Data/hora</div>
            <div style={{ fontSize: 14 }}>
              {formatDateTime(security?.ultimo_login?.em || security?.ultimo_acesso)}
            </div>
          </div>
          <div>
            <div className="form-label">IP</div>
            <div style={{ fontSize: 14 }}>{security?.ultimo_login?.ip || "—"}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Verificação de telefone / WhatsApp</div>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 12 }}>
          Confirme seu número para recursos que usam WhatsApp. Se o gateway não estiver
          configurado, o código será enviado por e-mail.
        </p>
        <div className="form-group">
          <label className="form-label">Telefone (com DDD)</label>
          <input
            className="form-input"
            type="tel"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="5599999999999"
          />
        </div>
        <button type="button" className="btn btn-secondary" onClick={handleVerifyPhone}>
          Enviar código de verificação
        </button>
      </div>

      <div className="card">
        <div className="card-title">Alterar senha</div>
        <form onSubmit={handleChangePassword}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Senha atual</label>
              <input
                className="form-input"
                type="password"
                value={pwd.atual}
                onChange={(e) => setPwd((p) => ({ ...p, atual: e.target.value }))}
                required
                autoComplete="current-password"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Nova senha</label>
              <input
                className="form-input"
                type="password"
                value={pwd.nova}
                onChange={(e) => setPwd((p) => ({ ...p, nova: e.target.value }))}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirmar nova senha</label>
              <input
                className="form-input"
                type="password"
                value={pwd.confirma}
                onChange={(e) => setPwd((p) => ({ ...p, confirma: e.target.value }))}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <button type="submit" className="btn btn-primary" disabled={changingPwd}>
              {changingPwd ? "Enviando código…" : "Solicitar código e alterar senha"}
            </button>
          </div>
        </form>
      </div>

      <OtpModal
        open={Boolean(otpModal)}
        title={
          otpModal?.mode === "verify_phone"
            ? "Verificar telefone"
            : "Confirmar alteração de senha"
        }
        subtitle="Digite o código de 6 dígitos enviado."
        otpId={otpModal?.otp_id}
        expiresAt={otpModal?.expires_at}
        ttlMinutes={otpModal?.ttl_minutes || 10}
        aviso={otpModal?.aviso}
        destinoMascarado={otpModal?.destino_mascarado}
        canal={otpModal?.canal}
        tipo={otpModal?.mode === "verify_phone" ? "verificar_telefone" : "acao_sensivel"}
        busy={otpBusy}
        onVerify={
          otpModal?.mode === "verify_phone" ? confirmVerifyPhone : confirmChangePassword
        }
        onResend={resendOtp}
        onClose={() => setOtpModal(null)}
      />
    </div>
  );
}
