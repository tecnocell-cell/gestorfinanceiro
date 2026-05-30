import { useState } from "react";
import { css } from "../styles.js";
import { authApi, tokenStorage } from "../api.js";
import { User, Building2, Mail, Smartphone, AlertTriangle } from "../components/icons.jsx";
import { BrandLogo } from "../components/BrandLogo.jsx";

const STEPS = { dados: "dados", verificacao: "verificacao" };

const STEP_META = {
  [STEPS.dados]: { title: "Criar conta", sub: "Passo 1 de 2 — seus dados" },
  [STEPS.verificacao]: { title: "Verificar conta", sub: "Passo 2 de 2 — escolha o canal e confirme" },
};

export default function RegisterPage({ onLogin, onVerified }) {
  const [step, setStep] = useState(STEPS.dados);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [devCode, setDevCode] = useState(null);
  const [codigoEnviado, setCodigoEnviado] = useState(false);

  const [form, setForm] = useState({
    tipo_perfil: "fisica",
    nome: "",
    nome_perfil: "",
    email: "",
    telefone: "",
    senha: "",
    senha2: "",
    canal_verificacao: "email",
  });

  const [verify, setVerify] = useState({ email: "", codigo: "", canal: "email" });
  const [jaCadastrado, setJaCadastrado] = useState(false);

  const set = (k, v) => {
    setError(null);
    setForm((p) => ({ ...p, [k]: v }));
  };

  const validateDados = () => {
    if (!form.nome.trim() || !form.nome_perfil.trim() || !form.email.trim()) {
      setError("Preencha nome, perfil/empresa e e-mail.");
      return false;
    }
    if (form.senha.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres.");
      return false;
    }
    if (form.senha !== form.senha2) {
      setError("As senhas não coincidem.");
      return false;
    }
    return true;
  };

  const goToVerificacao = (e) => {
    e.preventDefault();
    if (!validateDados()) return;
    setError(null);
    setInfo(null);
    setDevCode(null);
    setCodigoEnviado(false);
    setStep(STEPS.verificacao);
  };

  const validateCanal = () => {
    if (form.canal_verificacao === "sms" && !form.telefone.trim()) {
      setError("Informe o celular com DDD para receber o código por SMS.");
      return false;
    }
    return true;
  };

  const enviarCodigo = async () => {
    if (jaCadastrado) {
      const data = await authApi.resendCode({
        email: form.email.trim(),
        canal: form.canal_verificacao,
      });
      setVerify((p) => ({ ...p, canal: form.canal_verificacao, codigo: "" }));
      setInfo(data.message);
      if (data.dev_code) setDevCode(data.dev_code);
      setCodigoEnviado(true);
      return;
    }

    const data = await authApi.register({
      nome: form.nome.trim(),
      email: form.email.trim(),
      senha: form.senha,
      tipo_perfil: form.tipo_perfil,
      nome_perfil: form.nome_perfil.trim(),
      telefone: form.telefone.trim(),
      canal_verificacao: form.canal_verificacao,
    });
    setVerify({
      email: data.email,
      codigo: "",
      canal: data.canal || form.canal_verificacao,
    });
    setInfo(data.message);
    if (data.dev_code) setDevCode(data.dev_code);
    setJaCadastrado(true);
    setCodigoEnviado(true);
  };

  const handleEnviarCodigo = async (e) => {
    e.preventDefault();
    if (!validateCanal()) return;
    setLoading(true);
    setError(null);
    setDevCode(null);
    setInfo(null);
    try {
      await enviarCodigo();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await authApi.verify({
        email: verify.email,
        codigo: verify.codigo.trim(),
        canal: verify.canal,
      });
      tokenStorage.set(data.token);
      tokenStorage.setUser(data.user);
      onVerified?.(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authApi.resendCode({
        email: verify.email,
        canal: verify.canal,
      });
      setInfo(data.message);
      if (data.dev_code) setDevCode(data.dev_code);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const trocarCanal = () => {
    setError(null);
    setInfo(null);
    setDevCode(null);
    setCodigoEnviado(false);
    setVerify((p) => ({ ...p, codigo: "" }));
  };

  const stepIndex = step === STEPS.dados ? 0 : 1;
  const isPJ = form.tipo_perfil === "juridica";
  const meta = STEP_META[step];
  const destinoCodigo =
    verify.canal === "sms" ? form.telefone || "seu celular" : form.email;

  return (
    <>
      <style>{css}</style>
      <div className="login-page">
        <div className="login-card register-card">
          <div className="login-header">
            <div className="login-brand-logo-wrap">
              <BrandLogo variant="fluxiva" theme="dark" markSize={40} />
            </div>
            <h1 className="login-title">{meta.title}</h1>
            <p className="login-subtitle">{meta.sub}</p>
          </div>

          <div className="login-body register-body">
            <div className="register-steps">
              {[STEPS.dados, STEPS.verificacao].map((s, i) => (
                <span
                  key={s}
                  className={`register-step-dot${step === s ? " active" : ""}${stepIndex > i ? " done" : ""}`}
                />
              ))}
            </div>

            <div className="register-panel">
              {step === STEPS.dados && (
                <form className="register-form-fill" onSubmit={goToVerificacao}>
                  <div className="register-form-fields">
                    <label className="form-label">Tipo de conta</label>
                    <div className="register-type-row">
                      {[
                        ["fisica", User, "Pessoa Física"],
                        ["juridica", Building2, "Pessoa Jurídica"],
                      ].map(([v, Icon, label]) => (
                        <button
                          key={v}
                          type="button"
                          className={`profile-item ${form.tipo_perfil === v ? "active" : ""}`}
                          onClick={() => set("tipo_perfil", v)}
                        >
                          <span className="register-type-icon" aria-hidden><Icon size={16} strokeWidth={1.75} /></span>
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>

                    <div className="form-group">
                      <label className="form-label">Nome completo</label>
                      <input
                        className="form-input"
                        value={form.nome}
                        onChange={(e) => set("nome", e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        {isPJ ? "Empresa / razão social" : "Nome do perfil"}
                      </label>
                      <input
                        className="form-input"
                        value={form.nome_perfil}
                        onChange={(e) => set("nome_perfil", e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">E-mail</label>
                      <input
                        className="form-input"
                        type="email"
                        value={form.email}
                        onChange={(e) => set("email", e.target.value)}
                        required
                      />
                    </div>

                    <div className="register-senha-row">
                      <div className="form-group">
                        <label className="form-label">Senha</label>
                        <input
                          className="form-input"
                          type="password"
                          minLength={6}
                          value={form.senha}
                          onChange={(e) => set("senha", e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Confirmar</label>
                        <input
                          className="form-input"
                          type="password"
                          minLength={6}
                          value={form.senha2}
                          onChange={(e) => set("senha2", e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="register-form-actions">
                    {error && (
                      <div className="login-error">
                        <AlertTriangle size={16} strokeWidth={2} aria-hidden />
                        <span>{error}</span>
                      </div>
                    )}
                    <button type="submit" className="login-submit">
                      Próximo
                    </button>
                  </div>
                </form>
              )}

              {step === STEPS.verificacao && !codigoEnviado && (
                <form className="register-form-fill" onSubmit={handleEnviarCodigo}>
                  <div className="register-form-fields">
                    <label className="form-label">Receber código por</label>
                    <div className="register-canal-pick">
                      {[
                        ["email", Mail, "E-mail"],
                        ["sms", Smartphone, "SMS"],
                      ].map(([v, Icon, label]) => (
                        <button
                          key={v}
                          type="button"
                          className={`profile-item${form.canal_verificacao === v ? " active" : ""}`}
                          onClick={() => set("canal_verificacao", v)}
                        >
                          <span className="register-type-icon" aria-hidden><Icon size={16} strokeWidth={1.75} /></span>
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>

                    {form.canal_verificacao === "email" ? (
                      <p className="register-canal-mini">
                        Enviaremos para <strong>{form.email || "seu e-mail"}</strong>
                      </p>
                    ) : (
                      <div className="form-group">
                        <label className="form-label">Celular com DDD</label>
                        <input
                          className="form-input"
                          type="tel"
                          placeholder="11999999999"
                          value={form.telefone}
                          onChange={(e) => set("telefone", e.target.value)}
                          required
                        />
                      </div>
                    )}
                  </div>

                  <div className="register-form-actions">
                    {error && (
                      <div className="login-error">
                        <AlertTriangle size={16} strokeWidth={2} aria-hidden />
                        <span>{error}</span>
                      </div>
                    )}
                    <div className="register-nav-row">
                      <button
                        type="button"
                        className="btn btn-secondary register-btn-back"
                        disabled={loading}
                        onClick={() => {
                          setError(null);
                          setStep(STEPS.dados);
                        }}
                      >
                        Voltar
                      </button>
                      <button type="submit" disabled={loading} className="login-submit">
                        {loading ? "Enviando…" : "Enviar código"}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {step === STEPS.verificacao && codigoEnviado && (
                <form className="register-form-fill" onSubmit={handleVerify}>
                  <div className="register-form-fields">
                    {info && (
                      <div className="alert alert-info register-alert">{info}</div>
                    )}
                    {devCode && (
                      <div className="alert alert-warn register-alert register-dev-code">
                        Dev: código <strong>{devCode}</strong>
                      </div>
                    )}

                    <p className="register-canal-mini">
                      Código por <strong>{verify.canal === "sms" ? "SMS" : "e-mail"}</strong> em{" "}
                      <strong>{destinoCodigo}</strong>
                    </p>

                    <div className="form-group">
                      <label className="form-label">Código de 6 dígitos</label>
                      <input
                        className="form-input register-code-input"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="000000"
                        value={verify.codigo}
                        onChange={(e) =>
                          setVerify((p) => ({
                            ...p,
                            codigo: e.target.value.replace(/\D/g, ""),
                          }))
                        }
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="register-form-actions">
                    {error && (
                      <div className="login-error">
                        <AlertTriangle size={16} strokeWidth={2} aria-hidden />
                        <span>{error}</span>
                      </div>
                    )}
                    <button type="submit" disabled={loading} className="login-submit">
                      {loading ? "Verificando…" : "Ativar conta"}
                    </button>
                    <div className="register-actions-row">
                      <button
                        type="button"
                        className="btn btn-secondary register-btn-secondary"
                        disabled={loading}
                        onClick={handleResend}
                      >
                        Reenviar
                      </button>
                      <button
                        type="button"
                        className="login-link-btn"
                        disabled={loading}
                        onClick={trocarCanal}
                      >
                        Trocar canal
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>

            <p className="login-footer">
              Já tem conta?{" "}
              <button type="button" className="login-link-btn" onClick={onLogin}>
                Entrar
              </button>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
