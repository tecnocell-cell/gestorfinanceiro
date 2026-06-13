import {
  LayoutDashboard,
  ListChecks,
  BarChart3,
  Target,
  MessageCircle,
  Inbox,
  Type,
  Mic,
  Receipt,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Wallet,
} from "lucide-react";

type Item = {
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  preview: React.ReactNode;
};

const items: Item[] = [
  {
    title: "Dashboard",
    desc: "Visão geral do seu mês em segundos.",
    icon: LayoutDashboard,
    preview: <DashboardMock />,
  },
  {
    title: "Lançamentos",
    desc: "Entradas e saídas organizadas por categoria.",
    icon: ListChecks,
    preview: <LancamentosMock />,
  },
  {
    title: "Relatórios",
    desc: "Gráficos mensais e tendências automáticas.",
    icon: BarChart3,
    preview: <RelatoriosMock />,
  },
  {
    title: "Metas",
    desc: "Acompanhe objetivos pessoais e da empresa.",
    icon: Target,
    preview: <MetasMock />,
  },
  {
    title: "WhatsApp Financeiro",
    desc: "Operação 100% dentro do WhatsApp.",
    icon: MessageCircle,
    preview: <WhatsMock />,
  },
  {
    title: "Inbox WhatsApp",
    desc: "Todas as mensagens financeiras em um só lugar.",
    icon: Inbox,
    preview: <InboxMock />,
  },
  {
    title: "Lançamento por Texto",
    desc: "“Gastei 30 no mercado” e pronto.",
    icon: Type,
    preview: <TextoMock />,
  },
  {
    title: "Lançamento por Áudio",
    desc: "Fale, a IA transcreve e organiza.",
    icon: Mic,
    preview: <AudioMock />,
  },
  {
    title: "Leitura de Comprovantes",
    desc: "Envie a foto, a IA extrai os dados.",
    icon: Receipt,
    preview: <ReceiptMock />,
  },
  {
    title: "Confirmação SIM/NÃO",
    desc: "Você aprova cada lançamento no chat.",
    icon: CheckCircle2,
    preview: <ConfirmMock />,
  },
];

export function ProductShowcase() {
  return (
    <section
      id="produto"
      className="relative overflow-hidden py-24"
      style={{ background: "var(--gradient-dark)" }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(40% 30% at 80% 10%, rgba(31,168,90,0.45), transparent 70%), radial-gradient(35% 25% at 10% 90%, rgba(79,182,229,0.25), transparent 70%)",
        }}
      />


      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center text-white md:mb-14">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
            O produto por dentro
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            Veja o Fluxiva em ação
          </h2>
          <p className="mt-4 text-white/75">
            Do dashboard ao WhatsApp — uma visão completa do sistema real.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ title, desc, icon: Icon, preview }) => (
            <div
              key={title}
              className="group overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur transition-all hover:-translate-y-1 hover:border-[color:var(--primary-glow)]/50 hover:bg-white/10"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--primary-glow)]/20 text-[color:var(--primary-glow)]">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">{title}</h3>
                  <p className="text-xs text-white/65">{desc}</p>
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white text-foreground">
                {preview}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Mockups ---------- */

function DashboardMock() {
  return (
    <div className="p-4 text-xs">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-semibold">Outubro</span>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">Pessoal</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-secondary p-3">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><TrendingUp className="h-3 w-3 text-primary" /> Entradas</div>
          <p className="mt-1 text-sm font-bold">R$ 8.420</p>
        </div>
        <div className="rounded-xl bg-secondary p-3">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><TrendingDown className="h-3 w-3 text-rose-500" /> Saídas</div>
          <p className="mt-1 text-sm font-bold">R$ 5.190</p>
        </div>
      </div>
      <div className="mt-3 flex h-16 items-end gap-1.5">
        {[40, 65, 32, 80, 55, 70, 90, 45, 60].map((h, i) => (
          <div key={i} className="flex-1 rounded-t bg-primary/80" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

function LancamentosMock() {
  const rows = [
    { c: "Mercado", v: "-R$ 142,00", t: "Alimentação" },
    { c: "Uber", v: "-R$ 28,50", t: "Transporte" },
    { c: "Salário", v: "+R$ 6.000", t: "Renda" },
    { c: "Netflix", v: "-R$ 39,90", t: "Assinaturas" },
  ];
  return (
    <div className="divide-y divide-border text-xs">
      {rows.map((r) => (
        <div key={r.c} className="flex items-center justify-between px-4 py-2.5">
          <div>
            <p className="font-semibold">{r.c}</p>
            <p className="text-[10px] text-muted-foreground">{r.t}</p>
          </div>
          <span className={`font-bold ${r.v.startsWith("+") ? "text-primary" : "text-foreground"}`}>{r.v}</span>
        </div>
      ))}
    </div>
  );
}

function RelatoriosMock() {
  return (
    <div className="p-4">
      <p className="text-xs font-semibold">Gastos por categoria</p>
      <div className="mt-3 space-y-2 text-[11px]">
        {[
          { l: "Alimentação", v: 72, c: "var(--primary)" },
          { l: "Transporte", v: 48, c: "var(--primary-glow)" },
          { l: "Lazer", v: 34, c: "#063B22" },
          { l: "Assinaturas", v: 22, c: "#1FA85A" },
        ].map((b) => (
          <div key={b.l}>
            <div className="flex justify-between"><span>{b.l}</span><span className="text-muted-foreground">{b.v}%</span></div>
            <div className="mt-1 h-1.5 rounded-full bg-secondary">
              <div className="h-full rounded-full" style={{ width: `${b.v}%`, background: b.c }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetasMock() {
  return (
    <div className="space-y-2 p-4 text-xs">
      {[
        { n: "Viagem", v: 68 },
        { n: "Reserva", v: 42 },
        { n: "Notebook", v: 90 },
      ].map((m) => (
        <div key={m.n} className="rounded-xl bg-secondary p-3">
          <div className="mb-1 flex justify-between"><span className="font-semibold">{m.n}</span><span className="text-primary font-bold">{m.v}%</span></div>
          <div className="h-1.5 rounded-full bg-background">
            <div className="h-full rounded-full bg-primary" style={{ width: `${m.v}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function WhatsMock() {
  return (
    <div className="space-y-2 p-4 text-xs">
      <div className="flex justify-end"><span className="rounded-2xl rounded-br-sm bg-primary px-3 py-1.5 text-primary-foreground">Gastei 45 no Uber</span></div>
      <div className="flex justify-start"><span className="rounded-2xl rounded-bl-sm bg-secondary px-3 py-1.5">Transporte · R$ 45 — confirma? SIM/NÃO</span></div>
      <div className="flex justify-end"><span className="rounded-2xl rounded-br-sm bg-primary px-3 py-1.5 text-primary-foreground">SIM</span></div>
    </div>
  );
}

function InboxMock() {
  return (
    <div className="divide-y divide-border text-xs">
      {[
        { n: "Você", m: "Almoço cliente 78" },
        { n: "Maria (esposa)", m: "Mercado 210" },
        { n: "Equipe", m: "Combustível 220" },
      ].map((i) => (
        <div key={i.n} className="flex items-center gap-3 px-4 py-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{i.n[0]}</div>
          <div className="flex-1">
            <p className="font-semibold">{i.n}</p>
            <p className="text-[10px] text-muted-foreground">{i.m}</p>
          </div>
          <span className="h-2 w-2 rounded-full bg-primary" />
        </div>
      ))}
    </div>
  );
}

function TextoMock() {
  return (
    <div className="space-y-2 p-4 text-xs">
      <div className="flex justify-end"><span className="rounded-2xl rounded-br-sm bg-primary px-3 py-1.5 text-primary-foreground flex items-center gap-1"><Type className="h-3 w-3" />"gastei 30 no mercado"</span></div>
      <div className="flex justify-start"><span className="rounded-2xl rounded-bl-sm bg-secondary px-3 py-1.5"><b>Alimentação · R$ 30,00</b> · registrado.</span></div>
    </div>
  );
}

function AudioMock() {
  return (
    <div className="space-y-2 p-4 text-xs">
      <div className="flex justify-end">
        <span className="flex items-center gap-2 rounded-2xl rounded-br-sm bg-primary px-3 py-1.5 text-primary-foreground">
          <Mic className="h-3 w-3" />
          <span className="flex items-end gap-0.5">
            {[6, 12, 8, 16, 10, 14, 6].map((h, i) => (
              <span key={i} className="w-0.5 rounded-full bg-white/80" style={{ height: h }} />
            ))}
          </span>
          0:04
        </span>
      </div>
      <div className="flex justify-start"><span className="rounded-2xl rounded-bl-sm bg-secondary px-3 py-1.5">IA transcreveu: <b>"almoço cliente 78 reais"</b></span></div>
    </div>
  );
}

function ReceiptMock() {
  return (
    <div className="space-y-2 p-4 text-xs">
      <div className="flex justify-end">
        <div className="rounded-2xl rounded-br-sm bg-primary p-2 text-primary-foreground">
          <div className="flex h-16 w-24 items-center justify-center rounded-lg bg-white/15 text-[10px]">
            <Receipt className="h-5 w-5" />
          </div>
        </div>
      </div>
      <div className="flex justify-start">
        <div className="rounded-2xl rounded-bl-sm bg-secondary px-3 py-2">
          <p className="font-semibold">Posto Shell</p>
          <p className="text-[10px] text-muted-foreground">Combustível · R$ 220,00</p>
        </div>
      </div>
    </div>
  );
}

function ConfirmMock() {
  return (
    <div className="space-y-2 p-4 text-xs">
      <div className="flex justify-start"><span className="rounded-2xl rounded-bl-sm bg-secondary px-3 py-1.5">Confirma <b>R$ 142 · Mercado</b>?</span></div>
      <div className="flex gap-2">
        <button className="flex-1 rounded-full bg-primary py-1.5 text-[11px] font-semibold text-primary-foreground">SIM</button>
        <button className="flex-1 rounded-full border border-border bg-background py-1.5 text-[11px] font-semibold">NÃO</button>
      </div>
      <div className="flex items-center gap-1 text-[10px] text-primary"><Wallet className="h-3 w-3" /> Lançado em Alimentação</div>
    </div>
  );
}
