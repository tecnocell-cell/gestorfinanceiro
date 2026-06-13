/**
 * landing-spa/Plans.tsx — planos unificados Fluxiva (sem tabs PF/PJ).
 */
import { Check, Sparkles, Users, Smartphone, Bot } from "lucide-react";
import { FLUXIVA_PLANS, type CommercialPlanDisplay } from "@/lib/commercialPlans";

function PlanCard({ plan }: { plan: CommercialPlanDisplay }) {
  return (
    <div
      className={`relative flex flex-col rounded-3xl border p-7 transition-all ${
        plan.highlight
          ? "border-primary bg-primary/5 shadow-lg"
          : "border-border bg-card hover:border-primary/40"
      }`}
    >
      {plan.highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-bold text-primary-foreground">
          <Sparkles className="mr-1 inline h-3 w-3" /> Mais escolhido
        </span>
      )}
      <div>
        <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
        <p className="mt-4 text-3xl font-bold text-foreground">
          {plan.price}
          <span className="text-sm font-normal text-muted-foreground">/mês</span>
        </p>
      </div>

      <ul className="mt-5 space-y-2.5 text-sm">
        <li className="flex items-center gap-2 text-foreground">
          <Users className="h-4 w-4 shrink-0 text-primary" /> {plan.users}
        </li>
        <li className="flex items-center gap-2 text-foreground">
          <Smartphone className="h-4 w-4 shrink-0 text-primary" /> {plan.numbers}
        </li>
        <li className="flex items-center gap-2 text-foreground">
          <Bot className="h-4 w-4 shrink-0 text-primary" /> {plan.ai}
        </li>
        {plan.features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-foreground">
            <Check className="h-4 w-4 shrink-0 text-primary" /> {f}
          </li>
        ))}
      </ul>

      <a
        href={`/cadastro?plan=${plan.key}`}
        className={`mt-7 inline-flex w-full items-center justify-center rounded-full py-3 text-sm font-semibold transition-all hover:opacity-90 ${
          plan.highlight
            ? "bg-primary text-primary-foreground"
            : "border border-border bg-background text-foreground hover:bg-secondary"
        }`}
        style={plan.highlight ? { boxShadow: "var(--shadow-elegant)" } : {}}
      >
        Começar com {plan.name}
      </a>
    </div>
  );
}

export function Plans() {
  return (
    <section id="planos" className="mx-auto max-w-7xl px-6 py-24">
      <div className="mb-12 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          Planos Fluxiva
        </span>
        <h2 className="mt-4 text-3xl font-bold text-foreground md:text-4xl">
          Controle sua vida financeira e sua empresa no mesmo lugar
        </h2>
        <p className="mt-4 text-muted-foreground">
          Trial gratuito de 7 dias. Sem cartão. Cancele quando quiser.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {FLUXIVA_PLANS.map((p) => (
          <PlanCard key={p.key} plan={p} />
        ))}
      </div>
    </section>
  );
}
