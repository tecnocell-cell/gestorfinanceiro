import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Sparkles, Users, Smartphone, Bot } from "lucide-react";
import { PF_COMMERCIAL_PLANS, PJ_COMMERCIAL_PLANS } from "@/lib/commercialPlans";

export function Plans() {
  const [tab, setTab] = useState<"PF" | "PJ">("PF");
  const plans = tab === "PF" ? PF_COMMERCIAL_PLANS : PJ_COMMERCIAL_PLANS;

  return (
    <section id="planos" className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-24">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          Planos Fluxiva
        </span>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Escolha o plano ideal para você
        </h2>
        <p className="mt-4 text-muted-foreground">
          Pessoa Física ou Pessoa Jurídica — com limites claros e sem surpresas.
        </p>
      </div>

      <div className="mb-12 flex justify-center">
        <div
          className="inline-flex rounded-full border border-border bg-card p-1"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          {(["PF", "PJ"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-all sm:px-6 ${
                tab === t
                  ? "text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={tab === t ? { background: "var(--gradient-primary)" } : undefined}
            >
              {t === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3 md:gap-5 lg:gap-6">
        {plans.map((p) => (
          <div
            key={p.key}
            className={`relative rounded-3xl border p-7 transition-all duration-300 hover:-translate-y-2 ${
              p.highlight
                ? "border-transparent text-primary-foreground md:scale-[1.04]"
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
            <h3 className={`text-lg font-semibold ${p.highlight ? "text-white" : "text-foreground"}`}>{p.name}</h3>
            <p className={`mt-1 text-sm ${p.highlight ? "text-white/70" : "text-muted-foreground"}`}>{p.tagline}</p>
            <div className="mt-6 flex items-baseline gap-1">
              <span className={`text-5xl font-bold tracking-tight ${p.highlight ? "text-white" : "text-foreground"}`}>{p.price}</span>
              <span className={`text-sm ${p.highlight ? "text-white/70" : "text-muted-foreground"}`}>/mês</span>
            </div>

            <div className={`mt-5 space-y-2 rounded-2xl p-4 text-sm ${p.highlight ? "bg-white/10 backdrop-blur" : "bg-secondary"}`}>
              <Meta highlight={p.highlight} icon={<Users className="h-4 w-4" />} text={p.users} />
              <Meta highlight={p.highlight} icon={<Smartphone className="h-4 w-4" />} text={p.numbers} />
              <Meta highlight={p.highlight} icon={<Bot className="h-4 w-4" />} text={p.ai} />
            </div>

            <ul className="mt-5 space-y-3">
              {p.features.map((f) => (
                <li key={f} className={`flex items-start gap-2.5 text-sm ${p.highlight ? "text-white/90" : "text-foreground"}`}>
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                      p.highlight ? "bg-[color:var(--primary-glow)]/20" : "bg-primary/10"
                    }`}
                  >
                    <Check className={`h-3 w-3 ${p.highlight ? "text-[color:var(--primary-glow)]" : "text-primary"}`} />
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <Link
              to="/cadastro"
              search={{ plan: p.key }}
              className={`mt-7 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition-all hover:scale-[1.02] ${
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
