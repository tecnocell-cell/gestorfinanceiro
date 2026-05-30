/**
 * landing-spa/Plans.tsx
 * Versão dos planos para o build SPA — botões apontam para /cadastro?plan=X.
 */
import { useState } from "react";
import { Check, Sparkles, Users, Smartphone, Bot } from "lucide-react";

interface Plan {
  key:       string;
  name:      string;
  price:     string;
  tagline:   string;
  users:     string;
  numbers:   string;
  ai:        string;
  features:  string[];
  highlight?: boolean;
}

const pfPlans: Plan[] = [
  {
    key: "PF_BASIC", name: "PF Básico", price: "R$ 19,90", tagline: "Para começar a organizar.",
    users: "1 usuário", numbers: "1 número WhatsApp", ai: "Lançamento por texto",
    features: ["Relatórios essenciais", "Metas pessoais", "Categorias inteligentes"],
  },
  {
    key: "PF_PLUS", name: "PF Plus", price: "R$ 29,90", tagline: "Mais agilidade no dia a dia.",
    users: "1 usuário", numbers: "Até 3 números", ai: "Texto + áudio",
    features: ["Relatórios completos", "Categorias avançadas", "Lançamento por áudio"],
    highlight: true,
  },
  {
    key: "PF_PREMIUM", name: "PF Premium", price: "R$ 49,90", tagline: "O financeiro completo.",
    users: "1 usuário", numbers: "Até 5 números", ai: "Texto + áudio + comprovante",
    features: ["Leitura de comprovante por IA", "Suporte prioritário", "Tudo do Plus"],
  },
];

const pjPlans: Plan[] = [
  {
    key: "PJ_START", name: "PJ Start", price: "R$ 59,90", tagline: "Para equipes pequenas.",
    users: "Até 3 usuários", numbers: "Até 2 números", ai: "Texto + áudio",
    features: ["Centro de custo básico", "Relatórios PJ", "DRE simplificado"],
  },
  {
    key: "PJ_PRO", name: "PJ Pro", price: "R$ 99,90", tagline: "Para empresas em crescimento.",
    users: "Até 8 usuários", numbers: "Até 5 números", ai: "Texto + áudio + comprovante",
    features: ["Automações", "DRE completo", "Múltiplos centros de custo"],
    highlight: true,
  },
  {
    key: "PJ_BUSINESS", name: "PJ Business", price: "R$ 199,90", tagline: "Para empresas exigentes.",
    users: "Até 20 usuários", numbers: "Até 15 números", ai: "Recursos completos com IA",
    features: ["Governança financeira", "Suporte dedicado", "API access"],
  },
];

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div className={`relative flex flex-col rounded-3xl border p-7 transition-all ${
      plan.highlight
        ? "border-primary bg-primary/5 shadow-lg"
        : "border-border bg-card hover:border-primary/40"
    }`}>
      {plan.highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-bold text-primary-foreground">
          <Sparkles className="mr-1 inline h-3 w-3" />Mais popular
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
        <li className="flex items-center gap-2 text-foreground"><Users className="h-4 w-4 text-primary shrink-0" /> {plan.users}</li>
        <li className="flex items-center gap-2 text-foreground"><Smartphone className="h-4 w-4 text-primary shrink-0" /> {plan.numbers}</li>
        <li className="flex items-center gap-2 text-foreground"><Bot className="h-4 w-4 text-primary shrink-0" /> {plan.ai}</li>
        {plan.features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-foreground">
            <Check className="h-4 w-4 text-primary shrink-0" /> {f}
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
  const [tipo, setTipo] = useState<"PF" | "PJ">("PF");
  const plans = tipo === "PF" ? pfPlans : pjPlans;

  return (
    <section id="planos" className="mx-auto max-w-7xl px-6 py-24">
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-bold text-foreground md:text-4xl">
          Planos para cada momento
        </h2>
        <p className="mt-4 text-muted-foreground">
          Comece grátis por 14 dias. Sem cartão de crédito.
        </p>

        <div className="mt-8 inline-flex rounded-full border border-border bg-background p-1">
          {(["PF", "PJ"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTipo(t)}
              className={`rounded-full px-6 py-2 text-sm font-semibold transition-all ${
                tipo === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {t === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((p) => <PlanCard key={p.key} plan={p} />)}
      </div>
    </section>
  );
}
