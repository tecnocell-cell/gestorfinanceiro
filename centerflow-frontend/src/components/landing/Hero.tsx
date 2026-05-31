import { Link } from "@tanstack/react-router";
import { ArrowRight, MessageCircle, Mic, Receipt, Sparkles, ShieldCheck, Star } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Layered colored glows */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "var(--gradient-hero)" }}
      />
      <div className="pointer-events-none absolute -left-32 top-24 -z-10 h-72 w-72 rounded-full bg-[color:var(--accent-sky)] opacity-20 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 top-1/3 -z-10 h-80 w-80 rounded-full bg-[color:var(--accent-amber)] opacity-15 blur-3xl" />

      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2 lg:items-center lg:py-28">
        <div className="space-y-7">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-4 py-1.5 text-xs font-semibold text-primary backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> Seu financeiro no WhatsApp
          </span>
          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-[4rem]">
            Controle financeiro{" "}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>
              inteligente
            </span>{" "}
            no ritmo da sua vida.
          </h1>
          <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
            Lance gastos por texto, áudio ou foto do comprovante — a IA do Fluxiva organiza tudo para você,
            PF ou PJ, direto no WhatsApp.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/cadastro"
              className="group inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:scale-[1.03] hover:shadow-lg"
              style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-elegant)" }}
            >
              Criar conta grátis
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#planos"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-7 py-3.5 text-sm font-semibold text-foreground backdrop-blur transition-colors hover:bg-secondary"
            >
              Ver planos
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-[color:var(--accent-amber)] text-[color:var(--accent-amber)]" />
                ))}
              </div>
              <span className="font-semibold text-foreground">4.9</span>
              <span>de usuários</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Dados criptografados</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span>PF & PJ</span>
            </div>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div
            className="absolute -inset-6 -z-10 rounded-[3rem] opacity-40 blur-3xl"
            style={{ background: "var(--gradient-primary)" }}
          />
          <div
            className="rounded-3xl border border-border bg-card p-5 sm:p-6"
            style={{ boxShadow: "var(--shadow-elegant)" }}
          >
            {/* WhatsApp-like header */}
            <div
              className="-m-5 mb-4 rounded-t-3xl px-5 py-3.5 sm:-m-6 sm:mb-4 sm:px-6"
              style={{ background: "var(--gradient-primary)" }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 ring-2 ring-white/30">
                  <MessageCircle className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">Fluxiva Bot</p>
                  <p className="flex items-center gap-1.5 text-xs text-white/80">
                    <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent-mint)]" />
                    online agora
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Bubble side="right" time="09:14">Paguei 45 no Uber agora</Bubble>
              <Bubble side="left" time="09:14">
                <span className="font-semibold">Transporte · R$ 45,00</span>
                <br /> Confirma o lançamento? <span className="font-bold text-primary">SIM / NÃO</span>
              </Bubble>
              <Bubble side="right" time="12:42" icon={<Mic className="h-3.5 w-3.5" />}>
                Áudio: "almoço cliente 78 reais"
              </Bubble>
              <Bubble side="left" time="12:42">
                <span className="font-semibold">Alimentação PJ · R$ 78,00</span>
                <br /> Lançado em Despesas Comerciais.
              </Bubble>
              <Bubble side="right" time="15:08" icon={<Receipt className="h-3.5 w-3.5" />}>
                Foto do comprovante enviada
              </Bubble>
              <Bubble side="left" time="15:08">
                IA identificou: <b>Posto Shell · R$ 220,00</b> · Combustível
              </Bubble>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Bubble({
  children,
  side,
  icon,
  time,
}: {
  children: React.ReactNode;
  side: "left" | "right";
  icon?: React.ReactNode;
  time?: string;
}) {
  const isRight = side === "right";
  return (
    <div className={`flex ${isRight ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-[82%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
          isRight
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-secondary text-secondary-foreground"
        }`}
      >
        {icon && <span className="mr-1.5 inline-flex align-middle">{icon}</span>}
        {children}
        {time && (
          <span
            className={`ml-2 text-[10px] ${
              isRight ? "text-primary-foreground/70" : "text-muted-foreground"
            }`}
          >
            {time}
          </span>
        )}
      </div>
    </div>
  );
}
