/**
 * landing-spa/Hero.tsx
 * Versão do Hero para o build SPA — usa <a> em vez de TanStack Link.
 */
import { ArrowRight, MessageCircle, Mic, Receipt, Sparkles } from "lucide-react";

function FeaturePill({
  icon, label,
}: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground">
      <span className="text-primary">{icon}</span>
      {label}
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, color-mix(in oklab, var(--primary) 18%, transparent), transparent 70%)",
        }}
      />
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 md:py-28 lg:grid-cols-2 lg:items-center">
        <div className="space-y-7">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Seu financeiro no WhatsApp
          </span>

          <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-6xl">
            Controle financeiro{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "var(--gradient-primary)" }}
            >
              inteligente
            </span>{" "}
            no ritmo da sua vida.
          </h1>

          <p className="max-w-xl text-lg text-muted-foreground">
            Lance gastos por texto, áudio ou foto do comprovante — a IA do CenterFlow organiza
            tudo para você, PF ou PJ, direto no WhatsApp.
          </p>

          <div className="flex flex-wrap gap-3">
            <a
              href="/cadastro"
              className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02]"
              style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-elegant)" }}
            >
              Começar grátis <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#produto"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-7 py-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              Ver como funciona
            </a>
          </div>

          <div className="flex flex-wrap gap-3">
            <FeaturePill icon={<MessageCircle className="h-3.5 w-3.5" />} label="Lançamento por texto" />
            <FeaturePill icon={<Mic className="h-3.5 w-3.5" />}           label="Lançamento por áudio" />
            <FeaturePill icon={<Receipt className="h-3.5 w-3.5" />}       label="Leitura de comprovante" />
          </div>
        </div>

        {/* Preview card */}
        <div className="relative flex items-center justify-center">
          <div
            className="absolute inset-0 rounded-3xl blur-3xl"
            style={{
              background:
                "radial-gradient(circle, color-mix(in oklab, var(--primary) 15%, transparent), transparent 70%)",
            }}
          />
          <div
            className="relative w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-xl"
            style={{ boxShadow: "var(--shadow-elegant)" }}
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "var(--gradient-primary)" }}>
                <MessageCircle className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">CenterFlow IA</p>
                <p className="text-xs text-muted-foreground">WhatsApp Financeiro</p>
              </div>
            </div>
            <div className="space-y-3">
              {[
                { who: "Você",      msg: "paguei 50 gasolina", time: "09:12" },
                { who: "CenterFlow", msg: "Despesa 🔴\nValor: R$ 50,00\nDescrição: gasolina\n\nSIM para confirmar ou NAO para cancelar.", time: "09:12" },
                { who: "Você",      msg: "SIM", time: "09:13" },
                { who: "CenterFlow", msg: "✅ Lançamento criado!\nDespesa: R$ 50,00\nDescrição: gasolina", time: "09:13" },
              ].map((m, i) => (
                <div key={i} className={`flex ${m.who === "Você" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs whitespace-pre-line ${
                    m.who === "Você"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground"
                  }`}>
                    {m.msg}
                    <span className="mt-1 block text-right opacity-60">{m.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
