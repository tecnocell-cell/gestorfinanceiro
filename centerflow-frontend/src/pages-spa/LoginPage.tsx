/**
 * pages-spa/LoginPage.tsx
 *
 * Tela de login real para a landing SPA.
 * Chama POST /api/auth/login via centerflowApi.
 * Redireciona para VITE_CENTERFLOW_APP_URL?auth_token=… após sucesso.
 *
 * NÃO usa TanStack Router — usa <a> nativo e window.location.
 */

import { useState } from "react";
import {
  Eye, EyeOff, Mail, Lock,
  ShieldCheck, MessageCircle, Smartphone, ArrowRight, AlertCircle,
} from "lucide-react";
import {
  login, redirectToApp, APP_URL, type ApiError,
} from "@/lib/centerflowApi";
import { BrandLogo } from "@/components/BrandLogo";

// ── Componentes internos ──────────────────────────────────────────────────────

function IllustrationCard({
  icon, title, desc,
}: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">{icon}</div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-white/80">{desc}</p>
      </div>
    </div>
  );
}

function Field({
  label, icon, children,
}: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
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

// ── Página ────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const [form, setForm]       = useState({ email: "", senha: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [needsVerify, setNeedsVerify] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.senha) return;
    setError(null);
    setLoading(true);

    try {
      const data = await login(form.email.trim(), form.senha);
      redirectToApp(data.token, data.user);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 403 && (apiErr.data as any)?.needs_verification) {
        setNeedsVerify(true);
        setError(
          "Sua conta ainda não foi verificada. Verifique seu e-mail e use o link/código enviado."
        );
      } else {
        setError(apiErr.message || "Erro ao fazer login. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Painel visual esquerdo */}
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
            Lance gastos por texto, áudio ou foto. A IA da Fluxiva organiza para você, PF e PJ.
          </p>
          <div className="space-y-3">
            <IllustrationCard icon={<MessageCircle className="h-4 w-4" />} title="WhatsApp financeiro" desc="Tudo no chat que você já usa." />
            <IllustrationCard icon={<Smartphone className="h-4 w-4" />}    title="Múltiplos números"    desc="Família ou equipe lançando junto." />
            <IllustrationCard icon={<ShieldCheck className="h-4 w-4" />}   title="Confirmação SIM/NÃO"  desc="Você aprova cada lançamento." />
          </div>
        </div>

        <p className="relative text-xs text-white/70">© {new Date().getFullYear()} Fluxiva</p>
      </aside>

      {/* Formulário */}
      <main className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-md space-y-8">
          {/* Logo mobile */}
          <div className="lg:hidden">
            <a href="/" className="inline-flex items-center">
              <BrandLogo variant="fluxiva-financeiro" theme="light" markSize={36} />
            </a>
          </div>

          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Bem-vindo de volta</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Acesse sua conta para gerenciar seu financeiro.
            </p>
          </div>

          {/* Erro */}
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
              </a>
              .
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
            <a href="/cadastro" className="font-semibold text-primary hover:underline">
              Criar conta
            </a>
          </p>

          <p className="text-center text-xs text-muted-foreground">
            Acessar o{" "}
            <a href={APP_URL} className="underline hover:text-foreground">
              sistema financeiro diretamente
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
