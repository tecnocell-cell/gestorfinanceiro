import { Link } from "@tanstack/react-router";
import { Check, X, Sparkles, Users, Smartphone, Bot } from "lucide-react";
import { FLUXIVA_PLANS } from "@/lib/commercialPlans";

export function Plans() {
  const plans = FLUXIVA_PLANS;

  return (
    <section id="planos" className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-24">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          Planos Fluxiva
        </span>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Controle sua vida financeira e sua empresa em um único lugar
        </h2>
        <p className="mt-4 text-muted-foreground">
          Crie ambientes pessoais e empresariais. Gerencie múltiplos negócios na mesma conta.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((p) => (
          <div
            key={p.key}
            className={`relative flex flex-col rounded-3xl border p-6 transition-all duration-300 hover:-translate-y-1 ${
              p.highlight
                ? "border-transparent text-primary-foreground"
                : "border-border bg-card hover:border-primary/40"
            }`}
            style={
              p.highlight
                ? { background: "var(--gradient-dark)", boxShadow: "var(--shadow-elegant)" }
                : { boxShadow: "var(--shadow-card)" }
            }
          >
            {p.highlight && (
              <>
                <div
                  className="pointer-events-none absolute -inset-px rounded-3xl opacity-60"
                  style={{
                    background:
                      "linear-gradient(135deg, color-mix(in oklab, var(--primary-glow) 50%, transparent), transparent 60%)",
                    mask: "linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)",
                    WebkitMask: "linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)",
                    padding: 1,
                  }}
                />
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-3.5 py-1 text-xs font-bold text-[#042817] shadow-lg" style={{ background: "var(--gradient-primary-soft)" }}>
                  <Sparkles className="mr-1 inline h-3 w-3" /> Mais escolhido
                </span>
              </>
            )}

            <h3 className={`text-base font-semibold ${p.highlight ? "text-white" : "text-foreground"}`}>{p.name}</h3>
            <p className={`mt-1 text-xs ${p.highlight ? "text-white/70" : "text-muted-foreground"}`}>{p.tagline}</p>
            <div className="mt-5 flex items-baseline gap-1">
              <span className={`text-4xl font-bold tracking-tight ${p.highlight ? "text-white" : "text-foreground"}`}>{p.price}</span>
              <span className={`text-xs ${p.highlight ? "text-white/70" : "text-muted-foreground"}`}>/mês</span>
            </div>

            <div className={`mt-4 space-y-1.5 rounded-2xl p-3 text-xs ${p.highlight ? "bg-white/10 backdrop-blur" : "bg-secondary"}`}>
              <Meta highlight={p.highlight} icon={<Users className="h-3.5 w-3.5" />} text={p.users} />
              <Meta highlight={p.highlight} icon={<Smartphone className="h-3.5 w-3.5" />} text={p.numbers} />
              <Meta highlight={p.highlight} icon={<Bot className="h-3.5 w-3.5" />} text={p.ai} />
            </div>

            <ul className="mt-4 flex-1 space-y-2.5">
              {p.features.map((f) => (
                <li key={f} className={`flex items-start gap-2 text-xs ${p.highlight ? "text-white/90" : "text-foreground"}`}>
                  <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${p.highlight ? "bg-[color:var(--primary-glow)]/20" : "bg-primary/10"}`}>
                    <Check className={`h-2.5 w-2.5 ${p.highlight ? "text-[color:var(--primary-glow)]" : "text-primary"}`} />
                  </span>
                  <span>{f}</span>
                </li>
              ))}
              {p.notIncluded?.map((f) => (
                <li key={f} className={`flex items-start gap-2 text-xs ${p.highlight ? "text-white/40" : "text-muted-foreground/60"}`}>
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted/40">
                    <X className="h-2.5 w-2.5" />
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <Link
              to="/cadastro"
              search={{ plan: p.key }}
              className={`mt-6 inline-flex w-full items-center justify-center rounded-full px-4 py-2.5 text-xs font-semibold transition-all hover:scale-[1.02] ${
                p.highlight
                  ? "bg-white text-[#063B22] hover:bg-white/95"
                  : "border border-border bg-background text-foreground hover:border-primary/40 hover:bg-secondary"
              }`}
            >
              Assinar {p.name}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

function Meta({ icon, text, highlight }: { icon: React.ReactNode; text: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${highlight ? "text-white/90" : "text-foreground"}`}>
      <span className={highlight ? "text-[color:var(--primary-glow)]" : "text-primary"}>{icon}</span>
      <span className="font-medium">{text}</span>
    </div>
  );
}
