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
  { icon: Wallet, title: "Financeiro PF", desc: "Suas finanças pessoais organizadas com categorias inteligentes." },
  { icon: Building2, title: "Financeiro PJ", desc: "Separe contas da empresa e tenha visão clara do caixa." },
  { icon: ListPlus, title: "Lançamentos rápidos", desc: "Registre entradas e saídas em segundos." },
  { icon: BarChart3, title: "Relatórios", desc: "Gráficos e relatórios mensais para decisões melhores." },
  { icon: Target, title: "Metas", desc: "Defina objetivos e acompanhe o progresso." },
  { icon: MessageCircle, title: "WhatsApp financeiro", desc: "Tudo dentro do WhatsApp, sem trocar de app." },
  { icon: Type, title: "Lançamento por texto", desc: "“Gastei 30 no mercado” e pronto." },
  { icon: Mic, title: "Lançamento por áudio", desc: "Fale o gasto, a IA transcreve e organiza." },
  { icon: ScanLine, title: "Leitura por IA", desc: "Envie a foto do comprovante e deixe a IA cuidar." },
  { icon: CheckCircle2, title: "Confirmação SIM/NÃO", desc: "Aprove cada lançamento com um clique no chat." },
  { icon: Users, title: "Múltiplos números", desc: "Autorize sua família ou equipe a lançar também." },
  { icon: ShieldCheck, title: "Planos com limites", desc: "Escolha o plano ideal e cresça sem surpresas." },
];

export function Features() {
  return (
    <section id="recursos" className="mx-auto max-w-7xl px-6 py-24">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Recursos que trabalham por você
        </h2>
        <p className="mt-4 text-muted-foreground">
          Do lançamento por áudio à confirmação no WhatsApp — tudo o que você precisa para um financeiro sem esforço.
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="group rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary/40"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
