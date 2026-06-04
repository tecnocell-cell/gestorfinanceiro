import { useCallback, useEffect, useState } from "react";
import { authApi } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { AlertTriangle } from "../components/icons.jsx";
import OtpModal from "../components/OtpModal.jsx";
import ConfigStatusBanner from "../components/ConfigStatusBanner.jsx";
import useConfigStatus from "../hooks/useConfigStatus.js";

const PAGE_CSS = `
.sec-grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
.sec-card {
  margin: 0;
  border-radius: 14px;
  border: 1px solid oklch(0.92 0.01 150);
  padding: 16px 18px;
  background: #fff;
  box-shadow: 0 4px 16px oklch(0.45 0.03 155 / 0.06);
}
.sec-card-title { font-size: 14px; font-weight: 700; margin: 0 0 10px; color: var(--text, #0f172a); }
.sec-muted { font-size: 12px; color: var(--muted-foreground, #64748b); margin: 0 0 12px; line-height: 1.45; }
.sec-badge {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px;
}
.sec-badge--ok { background: oklch(0.95 0.04 150); color: var(--green-dark, #166534); }
.sec-badge--warn { background: oklch(0.96 0.04 85); color: oklch(0.45 0.08 75); }
.sec-badge--muted { background: oklch(0.96 0.01 250); color: #475569; }
.sec-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 12px; }
.sec-table { width: 100%; font-size: 12px; border-collapse: collapse; }
.sec-table th { text-align: left; padding: 8px 6px; border-bottom: 1px solid oklch(0.92 0.01 150); color: var(--muted-foreground); font-weight: 600; }
.sec-table td { padding: 8px 6px; border-bottom: 1px solid oklch(0.96 0.01 150); color: var(--text, #0f172a); }
`;

function formatDateTime(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return "—";
  }
}

function shortUa(ua) {
  if (!ua) return "—";
  if (ua.length <= 48) return ua;
  return `${ua.slice(0, 45)}…`;
}

export default function SegurancaPage() {
  const { user } = useAuth();
  const { status: configStatus } = useConfigStatus();
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
  const [savingPhone, setSavingPhone] = useState(false);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const data = await authApi.security();
      setSecurity(data);
      setTelefone(data.telefone || "");
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

  const handleSavePhone = async () => {
    setMsg("");
    setError("");
    setSavingPhone(true);
    try {
      const data = await authApi.updateTelefone(telefone);
      setTelefone(data.telefone || telefone);
      setMsg("Telefone salvo. Agora você pode enviar o código de verificação.");
      await load();
    } catch (err) {
      setError(err.message || "Erro ao salvar telefone.");
    } finally {
      setSavingPhone(false);
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
      setError("Informe e salve o telefone antes de verificar.");
      return;
    }
    try {
      await authApi.updateTelefone(telefone);
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
      setMsg(
        sent.aviso ||
          (sent.canal === "whatsapp"
            ? "Código enviado por WhatsApp."
            : "Código enviado por e-mail.")
      );
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
    const canal = otpModal.mode === "verify_phone" ? "whatsapp" : "email";
    const data = await authApi.otpSend({ tipo, canal });
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
  const phoneVerified = Boolean(security?.telefone_verificado);
  const emailConfigured =
    security?.email_configurado ?? configStatus?.email?.configured ?? true;
  const logins = security?.logins_recentes?.length
    ? security.logins_recentes
    : security?.ultimo_login
      ? [security.ultimo_login]
      : [];

  return (
    <div className="seguranca-page">
      <style>{PAGE_CSS}</style>

      <div className="page-header" style={{ marginBottom: 16 }}>
        <h1 className="page-title">Segurança da conta</h1>
        <p className="page-sub">Verificação, senha e histórico de acesso.</p>
      </div>

      <ConfigStatusBanner status={configStatus} keys={["email", "whatsapp"]} compact />

      {!emailConfigured && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            borderRadius: 12,
            background: "oklch(0.98 0.02 85)",
            border: "1px solid oklch(0.88 0.05 85)",
            fontSize: 13,
            color: "var(--text, #0f172a)",
          }}
        >
          Envio automático de e-mail em ativação. Se precisar redefinir senha agora, fale com o
          suporte.
        </div>
      )}

      {loading && <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Carregando…</p>}

      {error && (
        <div className="login-error" style={{ marginBottom: 12 }}>
          <AlertTriangle size={15} strokeWidth={2} aria-hidden />
          <span>{error}</span>
        </div>
      )}
      {msg && (
        <div style={{ marginBottom: 12, fontSize: 13, color: "var(--green-dark)" }}>{msg}</div>
      )}

      <div className="sec-grid">
        <div className="sec-card">
          <h2 className="sec-card-title">E-mail</h2>
          <p className="sec-muted">
            Conta: <strong>{security?.email || user?.email}</strong>
          </p>
          <div className="sec-row">
            <span
              className={`sec-badge ${verified ? "sec-badge--ok" : "sec-badge--warn"}`}
            >
              {verified ? "Verificado" : "Não verificado"}
            </span>
            {verified && (
              <span className="sec-muted" style={{ margin: 0 }}>
                {formatDateTime(security?.email_verificado_em)}
              </span>
            )}
          </div>
          {!verified && (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={sendingVerify}
                onClick={handleResend}
                style={{ marginBottom: 12 }}
              >
                {sendingVerify ? "Enviando…" : "Reenviar verificação"}
              </button>
              <form onSubmit={handleVerifyToken}>
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <label className="form-label">Token do e-mail</label>
                  <input
                    className="form-input"
                    type="text"
                    value={verifyToken}
                    onChange={(e) => setVerifyToken(e.target.value)}
                    placeholder="Cole o token recebido"
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={verifying || !verifyToken.trim()}
                >
                  {verifying ? "Validando…" : "Confirmar e-mail"}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="sec-card">
          <h2 className="sec-card-title">Telefone / WhatsApp</h2>
          <p className="sec-muted">
            Cadastre seu número para OTP por WhatsApp. Sem gateway, o código vai por e-mail.
          </p>
          <div className="sec-row">
            <span
              className={`sec-badge ${
                phoneVerified ? "sec-badge--ok" : telefone ? "sec-badge--warn" : "sec-badge--muted"
              }`}
            >
              {phoneVerified
                ? "Verificado"
                : telefone
                  ? "Pendente"
                  : "Não cadastrado"}
            </span>
          </div>
          <div className="form-group" style={{ marginBottom: 8 }}>
            <label className="form-label">Telefone (DDD + número)</label>
            <input
              className="form-input"
              type="tel"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="5599999999999"
            />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={savingPhone}
              onClick={handleSavePhone}
            >
              {savingPhone ? "Salvando…" : "Salvar telefone"}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleVerifyPhone}
              disabled={!telefone.trim()}
            >
              Enviar código
            </button>
          </div>
        </div>
      </div>

      <div className="sec-card" style={{ marginTop: 14 }}>
        <h2 className="sec-card-title">Alterar senha</h2>
        <p className="sec-muted">Exigimos um código OTP por e-mail ou WhatsApp antes de trocar a senha.</p>
        <form onSubmit={handleChangePassword}>
          <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
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
              <label className="form-label">Confirmar</label>
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
          <button type="submit" className="btn btn-primary btn-sm" disabled={changingPwd} style={{ marginTop: 12 }}>
            {changingPwd ? "Enviando código…" : "Solicitar código e alterar"}
          </button>
        </form>
      </div>

      <div className="sec-card" style={{ marginTop: 14 }}>
        <h2 className="sec-card-title">Últimos logins</h2>
        <table className="sec-table">
          <thead>
            <tr>
              <th>Data/hora</th>
              <th>IP</th>
              <th>Navegador</th>
            </tr>
          </thead>
          <tbody>
            {logins.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ color: "var(--muted-foreground)" }}>
                  Nenhum login registrado.
                </td>
              </tr>
            ) : (
              logins.map((l, i) => (
                <tr key={`${l.em}-${i}`}>
                  <td>{formatDateTime(l.em)}</td>
                  <td>{l.ip || "—"}</td>
                  <td title={l.user_agent}>{shortUa(l.user_agent)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
