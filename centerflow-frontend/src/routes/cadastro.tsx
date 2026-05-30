import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Wallet, User, Mail, Phone, ArrowRight, ArrowLeft, Check,
  Users, Smartphone, Bot, Sparkles, MailCheck,
} from "lucide-react";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta — CenterFlow Financeiro" },
      { name: "description", content: "Crie sua conta CenterFlow em poucos passos." },
    ],
  }),
  component: CadastroPage,
});

type PlanKey = "PF_BASICO" | "PF_PLUS" | "PF_PREMIUM" | "PJ_START" | "PJ_PRO" | "PJ_BUSINESS";

const PLANS: Record<PlanKey, {
  label: string; price: string; type: "PF" | "PJ"; users: string; numbers: string; ai: string; features: string[];
}> = {
  PF_BASICO:   { label: "PF Básico",   price: "R$ 19,90", type: "PF", users: "1 usuário", numbers: "1 número WhatsApp",    ai: "Texto",                     features: ["Relatórios essenciais", "Metas pessoais"] },
  PF_PLUS:     { label: "PF Plus",     price: "R$ 29,90", type: "PF", users: "1 usuário", numbers: "Até 3 números",        ai: "Texto + áudio",             features: ["Relatórios completos", "Categorias avançadas"] },
  PF_PREMIUM:  { label: "PF Premium",  price: "R$ 49,90", type: "PF", users: "1 usuário", numbers: "Até 5 números",        ai: "Texto + áudio + comprovante", features: ["Leitura por IA", "Suporte prioritário"] },
  PJ_START:    { label: "PJ Start",    price: "R$ 59,90", type: "PJ", users: "Até 3 usuários", numbers: "Até 2 números",   ai: "Texto + áudio",             features: ["Centro de custo básico", "Relatórios PJ"] },
  PJ_PRO:      { label: "PJ Pro",      price: "R$ 99,90", type: "PJ", users: "Até 8 usuários", numbers: "Até 5 números",   ai: "Texto + áudio + comprovante", features: ["Automações", "DRE simplificado"] },
  PJ_BUSINESS: { label: "PJ Business", price: "R$ 199,90", type: "PJ", users: "Até 20 usuários", numbers: "Até 15 números", ai: "Recursos completos com IA", features: ["Governança", "Suporte dedicado"] },
};

const STEPS = ["Dados", "Plano", "Resumo", "Confirmação"];

function CadastroPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ nome: "", whatsapp: "", email: "", confirm: "" });
  const [tipo, setTipo] = useState<"PF" | "PJ">("PF");
  const [plan, setPlan] = useState<PlanKey>("PF_PLUS");

  const planos = useMemo(
    () => (Object.entries(PLANS) as [PlanKey, typeof PLANS[PlanKey]][]).filter(([, v]) => v.type === tipo),
    [tipo]
  );

  const canNext = useMemo(() => {
    if (step === 0) {
      return form.nome.trim().length > 1 && form.whatsapp.trim().length >= 8 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) && form.email === form.confirm;
    }
    return true;
  }, [step, form]);

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-soft)" }}>
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "var(--gradient-primary)" }}>
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-base font-bold text-foreground">CenterFlow <span className="text-primary">Financeiro</span></span>
          </Link>
          <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-primary">Já tenho conta</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        {/* Stepper */}
        <ol className="mb-10 flex items-center justify-between gap-2">
          {STEPS.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li key={label} className="flex flex-1 items-center gap-3">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-bold transition-all ${
                    done
                      ? "border-primary bg-primary text-primary-foreground"
                      : active
                      ? "border-primary text-primary"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span className={`hidden text-xs font-semibold sm:block ${active || done ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                {i < STEPS.length - 1 && <div className={`h-px flex-1 ${done ? "bg-primary" : "bg-border"}`} />}
              </li>
            );
          })}
        </ol>

        <div className="rounded-3xl border border-border bg-card p-8" style={{ boxShadow: "var(--shadow-card)" }}>
          {step === 0 && (
            <div className="space-y-6">
              <Header title="Seus dados" desc="Vamos começar com algumas informações." />
              <Input icon={<User className="h-4 w-4" />} label="Nome completo" placeholder="Maria Silva"
                value={form.nome} onChange={(v) => setForm({ ...form, nome: v })} />
              <Input icon={<Phone className="h-4 w-4" />} label="WhatsApp" placeholder="(11) 99999-9999"
                value={form.whatsapp} onChange={(v) => setForm({ ...form, whatsapp: v })} />
              <Input icon={<Mail className="h-4 w-4" />} label="E-mail" placeholder="voce@email.com" type="email"
                value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <Input icon={<Mail className="h-4 w-4" />} label="Confirmar e-mail" placeholder="voce@email.com" type="email"
                value={form.confirm} onChange={(v) => setForm({ ...form, confirm: v })} />
              {form.confirm && form.email !== form.confirm && (
                <p className="text-xs text-rose-500">Os e-mails não coincidem.</p>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <Header title="Escolha seu plano" desc="Você pode trocar de plano a qualquer momento." />
              <div className="flex justify-center">
                <div className="inline-flex rounded-full border border-border bg-background p-1">
                  {(["PF", "PJ"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => { setTipo(t); setPlan(t === "PF" ? "PF_PLUS" : "PJ_PRO"); }}
                      className={`rounded-full px-5 py-1.5 text-sm font-semibold transition-all ${
                        tipo === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {t === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {planos.map(([key, p]) => {
                  const selected = plan === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setPlan(key)}
                      className={`rounded-2xl border p-5 text-left transition-all ${
                        selected ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-foreground">{p.label}</span>
                        {selected && <Check className="h-4 w-4 text-primary" />}
                      </div>
                      <p className="mt-2 text-2xl font-bold text-foreground">{p.price}<span className="text-xs font-normal text-muted-foreground">/mês</span></p>
                      <ul className="mt-3 space-y-1.5 text-xs text-foreground">
                        <li className="flex items-center gap-1.5"><Users className="h-3 w-3 text-primary" /> {p.users}</li>
                        <li className="flex items-center gap-1.5"><Smartphone className="h-3 w-3 text-primary" /> {p.numbers}</li>
                        <li className="flex items-center gap-1.5"><Bot className="h-3 w-3 text-primary" /> {p.ai}</li>
                      </ul>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <Header title="Resumo do seu pedido" desc="Confira antes de finalizar." />
              <div className="rounded-2xl border border-border bg-background p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Plano escolhido</p>
                    <p className="text-lg font-bold text-foreground">{PLANS[plan].label}</p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">{PLANS[plan].price}/mês</span>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-foreground">
                  <Row icon={<Users className="h-4 w-4" />} text={PLANS[plan].users} />
                  <Row icon={<Smartphone className="h-4 w-4" />} text={PLANS[plan].numbers} />
                  <Row icon={<Bot className="h-4 w-4" />} text={PLANS[plan].ai} />
                  {PLANS[plan].features.map((f) => <Row key={f} icon={<Check className="h-4 w-4" />} text={f} />)}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-background p-5 text-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Seus dados</p>
                <p className="mt-1 font-semibold text-foreground">{form.nome || "—"}</p>
                <p className="text-muted-foreground">{form.email} · {form.whatsapp}</p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 py-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
                <MailCheck className="h-8 w-8 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">Conta criada com sucesso!</h2>
                <p className="mt-2 text-muted-foreground">
                  Verifique seu e-mail para ativar sua conta.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Enviamos um link para <b className="text-foreground">{form.email || "seu e-mail"}</b>.</p>
              </div>
              <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 text-left">
                <p className="text-sm font-semibold text-foreground"><Sparkles className="mr-1 inline h-4 w-4 text-primary" /> Próximos passos</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <li>• Confirme seu e-mail</li>
                  <li>• Conecte seu número WhatsApp</li>
                  <li>• Faça seu primeiro lançamento</li>
                </ul>
              </div>
              <Link to="/login" className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground hover:opacity-90" style={{ boxShadow: "var(--shadow-elegant)" }}>
                Ir para o login <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}

          {step < 3 && (
            <div className="mt-8 flex items-center justify-between">
              <button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar
              </button>
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canNext}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-40"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                {step === 2 ? "Finalizar" : "Continuar"} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Header({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

function Input({
  icon, label, placeholder, value, onChange, type = "text",
}: { icon: React.ReactNode; label: string; placeholder: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 transition-colors focus-within:border-primary">
        <span className="text-muted-foreground">{icon}</span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>
    </div>
  );
}

function Row({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-primary">{icon}</span>
      <span>{text}</span>
    </div>
  );
}
