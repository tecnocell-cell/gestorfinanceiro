/**
 * pages-spa/LoginPage.tsx
 *
 * Tela de login real para a landing SPA.
 * Suporta fluxo OTP (REQUIRE_OTP_LOGIN ou login suspeito).
 * Redireciona para VITE_CENTERFLOW_APP_URL?auth_token=… após sucesso.
 */

import { useEffect, useRef, useState } from "react";
import {
  Eye, EyeOff, Mail, Lock,
  ShieldCheck, MessageCircle, Smartphone, ArrowRight, AlertCircle,
  KeyRound, RefreshCw,
} from "lucide-react";
import {
  login, verifyLoginOtp, resendLoginOtp,
  redirectToApp, APP_URL,
  type ApiError, type OtpRequiredData,
} from "@/lib/centerflowApi";
import { BrandLogo } from "@/components/BrandLogo";

// ── Painel esquerdo compartilhado ─────────────────────────────────────────────

function LeftPanel() {
  return (
    <aside
      className="relative hidden flex-col justify-between overflow-hidden p-12 text-primary-foreground lg:flex"
      style={{ background: "var(--gradient-primary)" }}
    >
      <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-white/10 blur-3xl" />

      <a href="/" className="relative flex items-center">
        <BrandLogo variant="fluxiva-financeiro" theme="dark" markSize={40} />
      </a>

      <div className="relative space-y-8">
        <h2 className="text-4xl font-bold leading-tight">
          Seu dinheiro,<br /> sob controle —<br /> no seu WhatsApp.
        </h2>
        <p className="max-w-md text-white/85">
          Lance gastos por texto, áudio ou foto. A IA da Fluxiva organiza para você — pessoal e empresa.
        </p>
        <div className="space-y-3">
          {[
            { icon: <MessageCircle className="h-4 w-4" />, title: "WhatsApp financeiro",  desc: "Tudo no chat que você já usa." },
            { icon: <Smartphone    className="h-4 w-4" />, title: "Múltiplos números",     desc: "Família ou equipe lançando junto." },
            { icon: <ShieldCheck   className="h-4 w-4" />, title: "Confirmação SIM/NÃO",  desc: "Você aprova cada lançamento." },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">{icon}</div>
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-xs text-white/80">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="relative text-xs text-white/70">© {new Date().getFullYear()} Fluxiva</p>
    </aside>
  );
}

// ── Campo de formulário ───────────────────────────────────────────────────────

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition-colors focus-within:border-primary">
        <span className="text-muted-foreground">{icon}</span>
        {children}
      </div>
    </div>
  );
}

// ── Caixas OTP (6 dígitos) ────────────────────────────────────────────────────
// Usa slots string[] internamente — sem padEnd/spaces, sem bugs de comprimento.

function OtpInputs({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  // value é uma string de 0–6 dígitos. slots sempre tem 6 posições.
  const slots = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  const commit = (i: number, char: string) => {
    const next = slots.map((s, idx) => (idx === i ? char : s)).join("");
    onChange(next);
  };

  const handleChange = (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");

    // Colagem via input (> 1 char): distribui pelos slots restantes
    if (raw.length > 1) {
      const chars = raw.slice(0, 6);
      const next = slots.map((s, idx) => {
        const pos = idx - i;
        return pos >= 0 && pos < chars.length ? chars[pos] : s;
      }).join("");
      onChange(next);
      refs.current[Math.min(i + chars.length - 1, 5)]?.focus();
      return;
    }

    const char = raw.slice(0, 1);
    commit(i, char);
    if (char && i < 5) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (slots[i]) {
        commit(i, "");
      } else if (i > 0) {
        commit(i - 1, "");
        refs.current[i - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft"  && i > 0) refs.current[i - 1]?.focus();
      else if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      onChange(pasted);
      refs.current[Math.min(pasted.length - 1, 5)]?.focus();
    }
  };

  return (
    <div className="flex justify-center gap-2.5">
      {slots.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={2}
          value={digit}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className="h-14 w-11 rounded-2xl border-2 border-border bg-card text-center text-xl font-bold text-foreground transition-all focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
        />
      ))}
    </div>
  );
}

// ── Countdown ─────────────────────────────────────────────────────────────────

function useCountdown(expiresAt: string | undefined) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setSeconds(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return seconds;
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function LoginPage() {
  const [form, setForm]             = useState({ email: "", senha: "" });
  const [showPwd, setShowPwd]       = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [needsVerify, setNeedsVerify] = useState(false);

  // Fluxo OTP
  const [otpFlow, setOtpFlow]     = useState<(OtpRequiredData & { email: string }) | null>(null);
  const [otpCode, setOtpCode]     = useState("");
  const [otpBusy, setOtpBusy]     = useState(false);
  const [resending, setResending] = useState(false);
  const countdown = useCountdown(otpFlow?.expires_at);
  const expired   = countdown === 0 && Boolean(otpFlow);

  // ── Login padrão ────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.senha) return;
    setError(null); setNeedsVerify(false); setOtpFlow(null); setOtpCode("");
    setLoading(true);
    try {
      const data = await login(form.email.trim(), form.senha);
      if ("requires_otp" in data && data.requires_otp) {
        setOtpFlow({ ...data, email: form.email.trim() });
        return;
      }
      redirectToApp(data.token, data.user);
    } catch (err) {
      const e = err as ApiError;
      if (e.status === 403 && (e.data as Record<string, unknown>)?.needs_verification) {
        setNeedsVerify(true);
        setError("Sua conta ainda não foi verificada. Verifique seu e-mail.");
      } else {
        setError(e.message || "Erro ao fazer login. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Confirmar OTP ───────────────────────────────────────────────────────────

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpFlow || otpCode.length < 6) return;
    setError(null); setOtpBusy(true);
    try {
      const data = await verifyLoginOtp(otpFlow.otp_id, otpCode);
      redirectToApp(data.token, data.user);
    } catch (err) {
      setError((err as ApiError).message || "Código inválido ou expirado.");
    } finally {
      setOtpBusy(false);
    }
  };

  // ── Reenviar código ─────────────────────────────────────────────────────────

  const handleResend = async () => {
    if (!otpFlow) return;
    setResending(true); setError(null);
    try {
      const fresh = await resendLoginOtp(otpFlow.otp_id);
      setOtpFlow((prev) => prev ? { ...prev, ...fresh, email: prev.email } : prev);
      setOtpCode("");
    } catch (err) {
      setError((err as ApiError).message || "Não foi possível reenviar.");
    } finally {
      setResending(false);
    }
  };

  // ── Tela OTP ────────────────────────────────────────────────────────────────

  if (otpFlow) {
    const canalLabel = otpFlow.canal === "whatsapp" ? "WhatsApp" : "e-mail";
    const mm = String(Math.floor(countdown / 60)).padStart(2, "0");
    const ss = String(countdown % 60).padStart(2, "0");
    const otpReady = otpCode.replace(/\D/g, "").length === 6;

    return (
      <div className="grid min-h-screen lg:grid-cols-2">
        <LeftPanel />

        <main className="flex items-center justify-center bg-background px-6 py-12">
          <div className="w-full max-w-md space-y-8">

            {/* Logo mobile */}
            <div className="lg:hidden">
              <a href="/"><BrandLogo variant="fluxiva-financeiro" theme="light" markSize={36} /></a>
            </div>

            {/* Cabeçalho */}
            <div className="flex flex-col items-center gap-4 text-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full"
                style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
              >
                <KeyRound className="h-7 w-7 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Verificação de segurança</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Enviamos um código de 6 dígitos para seu {canalLabel}{" "}
                  <span className="font-semibold text-foreground">{otpFlow.destino_mascarado}</span>.
                </p>
              </div>
            </div>

            {/* Erro */}
            {error && (
              <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Aviso de canal (ex: WhatsApp indisponível → e-mail) */}
            {otpFlow.aviso && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                {otpFlow.aviso}
              </div>
            )}

            {/* Código dev (só aparece quando e-mail não está configurado) */}
            {otpFlow.dev_codigo && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-center dark:border-blue-800 dark:bg-blue-950/30">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">Código dev (sem e-mail configurado)</p>
                <p className="mt-1 font-mono text-2xl font-bold tracking-[0.25em] text-blue-800 dark:text-blue-200">
                  {otpFlow.dev_codigo}
                </p>
              </div>
            )}

            {/* Formulário OTP */}
            <form onSubmit={handleOtpSubmit} className="space-y-6">
              <OtpInputs value={otpCode} onChange={setOtpCode} />

              {/* Countdown */}
              <div className="flex items-center justify-center gap-2 text-sm">
                {expired ? (
                  <span className="font-semibold text-destructive">Código expirado</span>
                ) : (
                  <>
                    <span className="text-muted-foreground">Expira em</span>
                    <span className="rounded-lg bg-muted px-2.5 py-0.5 font-mono font-semibold tabular-nums text-foreground">
                      {mm}:{ss}
                    </span>
                  </>
                )}
              </div>

              <button
                type="submit"
                disabled={otpBusy || !otpReady || expired}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ boxShadow: "var(--shadow-elegant)" }}
              >
                {otpBusy ? "Verificando..." : (<>Confirmar <ArrowRight className="h-4 w-4" /></>)}
              </button>
            </form>

            {/* Ações secundárias */}
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${resending ? "animate-spin" : ""}`} />
                {resending ? "Reenviando..." : "Reenviar código"}
              </button>
              <button
                type="button"
                onClick={() => { setOtpFlow(null); setOtpCode(""); setError(null); }}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Voltar ao login
              </button>
            </div>

          </div>
        </main>
      </div>
    );
  }

  // ── Tela de login ────────────────────────────────────────────────────────────

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <LeftPanel />

      <main className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-md space-y-8">

          {/* Logo mobile */}
          <div className="lg:hidden">
            <a href="/"><BrandLogo variant="fluxiva-financeiro" theme="light" markSize={36} /></a>
          </div>

          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Bem-vindo de volta</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Acesse sua conta para gerenciar seu financeiro.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {needsVerify && (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
              Acesse seu e-mail e clique no link de verificação, ou{" "}
              <a href={`/verificar?email=${encodeURIComponent(form.email)}`} className="font-semibold text-primary hover:underline">
                insira o código aqui
              </a>.
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <Field label="E-mail" icon={<Mail className="h-4 w-4" />}>
              <input
                type="email"
                placeholder="voce@email.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
                autoFocus
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </Field>

            <Field label="Senha" icon={<Lock className="h-4 w-4" />}>
              <input
                type={showPwd ? "text" : "password"}
                placeholder="••••••••"
                value={form.senha}
                onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
                required
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Mostrar senha"
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </Field>

            <button
              type="submit"
              disabled={loading || !form.email || !form.senha}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ boxShadow: "var(--shadow-elegant)" }}
            >
              {loading ? "Entrando..." : (<>Entrar <ArrowRight className="h-4 w-4" /></>)}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Ainda não tem conta?{" "}
            <a href="/cadastro" className="font-semibold text-primary hover:underline">Criar conta</a>
          </p>

          <p className="text-center text-xs text-muted-foreground">
            Acessar o{" "}
            <a href={APP_URL} className="underline hover:text-foreground">sistema financeiro diretamente</a>
          </p>

        </div>
      </main>
    </div>
  );
}
