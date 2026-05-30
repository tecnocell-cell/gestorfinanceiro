import { Link } from "@tanstack/react-router";
import { ArrowRight, MessageCircle, Mic, Receipt, Sparkles } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{ background: "radial-gradient(60% 50% at 50% 0%, color-mix(in oklab, var(--primary) 18%, transparent), transparent 70%)" }}
      />
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 md:py-28 lg:grid-cols-2 lg:items-center">
        <div className="space-y-7">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Seu financeiro no WhatsApp
          </span>
          <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-6xl">
            Controle financeiro{" "}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>
              inteligente
            </span>{" "}
            no ritmo da sua vida.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Lance gastos por texto, áudio ou foto do comprovante — a IA do CenterFlow organiza tudo para você, PF ou PJ, direto no WhatsApp.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/cadastro"
              className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02]"
              style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-elegant)" }}
            >
              Criar conta grátis <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#planos"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-7 py-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              Ver planos
            </a>
          </div>
          <div className="flex flex-wrap gap-6 pt-2 text-sm text-muted-foreground">
            <Stat label="Lançamentos automáticos" />
            <Stat label="IA de comprovantes" />
            <Stat label="PF & PJ" />
          </div>
        </div>

        <div className="relative">
          <div
            className="absolute -inset-6 -z-10 rounded-[3rem] opacity-30 blur-3xl"
            style={{ background: "var(--gradient-primary)" }}
          />
          <div
            className="rounded-3xl border border-border bg-card p-6"
            style={{ boxShadow: "var(--shadow-elegant)" }}
          >
            <div className="mb-4 flex items-center gap-2 border-b border-border pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                <MessageCircle className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">CenterFlow Bot</p>
                <p className="text-xs text-muted-foreground">online no WhatsApp</p>
              </div>
            </div>
            <div className="space-y-3">
              <Bubble side="right">Paguei 45 no Uber agora</Bubble>
              <Bubble side="left">
                <span className="font-semibold">Transporte · R$ 45,00</span>
                <br /> Confirma o lançamento? <span className="text-primary">SIM / NÃO</span>
              </Bubble>
              <Bubble side="right" icon={<Mic className="h-3.5 w-3.5" />}>
                Áudio: "almoço cliente 78 reais"
              </Bubble>
              <Bubble side="left">
                <span className="font-semibold">Alimentação PJ · R$ 78,00</span>
                <br /> Lançado em Despesas Comerciais.
              </Bubble>
              <Bubble side="right" icon={<Receipt className="h-3.5 w-3.5" />}>
                Foto do comprovante enviada
              </Bubble>
              <Bubble side="left">
                IA identificou: <b>Posto Shell · R$ 220,00</b> · Combustível
              </Bubble>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-2 rounded-full bg-primary" />
      <span>{label}</span>
    </div>
  );
}

function Bubble({
  children,
  side,
  icon,
}: {
  children: React.ReactNode;
  side: "left" | "right";
  icon?: React.ReactNode;
}) {
  const isRight = side === "right";
  return (
    <div className={`flex ${isRight ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
          isRight
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-secondary text-secondary-foreground"
        }`}
      >
        {icon && <span className="mr-1.5 inline-flex align-middle">{icon}</span>}
        {children}
      </div>
    </div>
  );
}
