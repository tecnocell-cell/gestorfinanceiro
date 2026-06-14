import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  Wallet,
  ShieldCheck,
  MessageCircle,
  Smartphone,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Fluxiva Financeiro" },
      { name: "description", content: "Acesse sua conta Fluxiva Financeiro." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [showPwd, setShowPwd] = useState(false);

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left visual */}
      <aside
        className="relative hidden flex-col justify-between overflow-hidden p-12 text-primary-foreground lg:flex"
        style={{ background: "var(--gradient-primary)" }}
      >
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-white/10 blur-3xl" />

        <Link to="/" className="relative flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <Wallet className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold">Fluxiva Financeiro</span>
        </Link>

        <div className="relative space-y-8">
          <h2 className="text-4xl font-bold leading-tight">
            Seu dinheiro,<br /> sob controle —<br /> no seu WhatsApp.
          </h2>
          <p className="max-w-md text-white/85">
            Lance gastos por texto, áudio ou foto. A IA do Fluxiva organiza para você — pessoal e empresa.
          </p>

          <div className="space-y-3">
            <IllustrationCard icon={<MessageCircle className="h-4 w-4" />} title="WhatsApp financeiro" desc="Tudo no chat que você já usa." />
            <IllustrationCard icon={<Smartphone className="h-4 w-4" />} title="Múltiplos números" desc="Família ou equipe lançando junto." />
            <IllustrationCard icon={<ShieldCheck className="h-4 w-4" />} title="Confirmação SIM/NÃO" desc="Você aprova cada lançamento." />
          </div>
        </div>

        <p className="relative text-xs text-white/70">© {new Date().getFullYear()} Fluxiva</p>
      </aside>

      {/* Right form */}
      <main className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden">
            <Link to="/" className="inline-flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "var(--gradient-primary)" }}>
                <Wallet className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-base font-bold text-foreground">Fluxiva</span>
            </Link>
          </div>

          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Bem-vindo de volta</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Acesse sua conta para gerenciar seu financeiro.
            </p>
          </div>

          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <Field label="E-mail" icon={<Mail className="h-4 w-4" />}>
              <input
                type="email"
                placeholder="voce@email.com"
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </Field>

            <Field label="Senha" icon={<Lock className="h-4 w-4" />}>
              <input
                type={showPwd ? "text" : "password"}
                placeholder="••••••••"
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

            {/* Espaço visual para verificação futura */}
            <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Verificação em duas etapas</p>
                  <p className="text-xs text-muted-foreground">
                    Em breve: confirme seu acesso por e-mail ou SMS.
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  em breve
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-muted-foreground">
                <input type="checkbox" className="h-4 w-4 rounded border-border accent-primary" />
                Lembrar de mim
              </label>
              <a href="#" className="font-medium text-primary hover:underline">
                Esqueceu a senha?
              </a>
            </div>

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90"
              style={{ boxShadow: "var(--shadow-elegant)" }}
            >
              Entrar <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Ainda não tem conta?{" "}
            <Link to="/cadastro" className="font-semibold text-primary hover:underline">
              Criar conta
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
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

function IllustrationCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
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
