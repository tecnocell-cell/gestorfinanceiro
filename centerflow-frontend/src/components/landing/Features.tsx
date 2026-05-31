import {
  Wallet,
  Building2,
  ListPlus,
  BarChart3,
  Target,
  MessageCircle,
  Type,
  Mic,
  ScanLine,
  CheckCircle2,
  Users,
  ShieldCheck,
} from "lucide-react";

const features = [
  { icon: Wallet, title: "Financeiro PF", desc: "Suas finanças pessoais organizadas com categorias inteligentes.", color: "var(--primary)", bg: "color-mix(in oklab, var(--primary) 12%, white)" },
  { icon: Building2, title: "Financeiro PJ", desc: "Separe contas da empresa e tenha visão clara do caixa.", color: "var(--accent-sky)", bg: "var(--surface-sky)" },
  { icon: ListPlus, title: "Lançamentos rápidos", desc: "Registre entradas e saídas em segundos.", color: "var(--accent-amber)", bg: "var(--surface-warm)" },
  { icon: BarChart3, title: "Relatórios", desc: "Gráficos e relatórios mensais para decisões melhores.", color: "var(--accent-violet)", bg: "color-mix(in oklab, var(--accent-violet) 14%, white)" },
  { icon: Target, title: "Metas", desc: "Defina objetivos e acompanhe o progresso.", color: "var(--accent-coral)", bg: "color-mix(in oklab, var(--accent-coral) 14%, white)" },
  { icon: MessageCircle, title: "WhatsApp financeiro", desc: "Tudo dentro do WhatsApp, sem trocar de app.", color: "var(--primary)", bg: "var(--surface-mint)" },
  { icon: Type, title: "Lançamento por texto", desc: "“Gastei 30 no mercado” e pronto.", color: "var(--accent-sky)", bg: "var(--surface-sky)" },
  { icon: Mic, title: "Lançamento por áudio", desc: "Fale o gasto, a IA transcreve e organiza.", color: "var(--accent-rose)", bg: "var(--surface-rose)" },
  { icon: ScanLine, title: "Leitura por IA", desc: "Envie a foto do comprovante e deixe a IA cuidar.", color: "var(--accent-violet)", bg: "color-mix(in oklab, var(--accent-violet) 12%, white)" },
  { icon: CheckCircle2, title: "Confirmação SIM/NÃO", desc: "Aprove cada lançamento com um clique no chat.", color: "var(--primary)", bg: "color-mix(in oklab, var(--primary) 12%, white)" },
  { icon: Users, title: "Múltiplos números", desc: "Autorize sua família ou equipe a lançar também.", color: "var(--accent-amber)", bg: "var(--surface-warm)" },
  { icon: ShieldCheck, title: "Planos com limites", desc: "Escolha o plano ideal e cresça sem surpresas.", color: "var(--accent-coral)", bg: "color-mix(in oklab, var(--accent-coral) 12%, white)" },
];

export function Features() {
  return (
    <section id="recursos" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-24">
      <div className="mx-auto mb-12 max-w-2xl text-center md:mb-14">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-xs font-semibold text-primary">
          Recursos
        </span>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Recursos que trabalham por você
        </h2>
        <p className="mt-4 text-muted-foreground">
          Do lançamento por áudio à confirmação no WhatsApp — tudo o que você precisa para um financeiro sem esforço.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, desc, color, bg }) => (
          <div
            key={title}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30"
            style={{ boxShadow: "var(--shadow-card)" }}
            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "var(--shadow-card-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "var(--shadow-card)")}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{ background: "var(--gradient-card-hover)" }}
            />
            <div className="relative">
              <div
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl ring-1 ring-black/5 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
                style={{ background: bg, color }}
              >
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-foreground">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
