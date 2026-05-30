/**
 * pages-spa/CadastroPage.tsx
 *
 * Wizard de cadastro real da landing SPA.
 *
 * Fluxo:
 *   Step 0 — Dados pessoais (nome, WhatsApp, e-mail, senha)
 *   Step 1 — Escolha do plano (pré-selecionado via ?plan=PLAN_KEY)
 *   Step 2 — Resumo
 *   Step 3 — Verificação do código enviado por e-mail
 *   Step 4 — Conta criada / redirecionamento
 *
 * API real:
 *   POST /api/auth/register → { ok, message, email, canal }
 *   POST /api/auth/verify   → { ok, token, user }
 *
 * Plano:
 *   O backend ainda não aceita plan_type.
 *   O plano é salvo em localStorage como "cf_pending_plan".
 *   O app autenticado pode ler esse valor para configurar o plano do usuário.
 */

import { useMemo, useState } from "react";
import {
  User, Mail, Phone, Lock, Eye, EyeOff,
  ArrowRight, ArrowLeft, Check, Users, Smartphone,
  Bot, Sparkles, MailCheck, AlertCircle, KeyRound,
} from "lucide-react";
import {
  register, verify, redirectToApp,
  savePendingPlan, type ApiError,
} from "@/lib/centerflowApi";
import { BrandLogo } from "@/components/BrandLogo";

// ── Planos ───────────────────────────────────────────────────────────────────

type PlanKey =
  | "PF_BASIC" | "PF_PLUS" | "PF_PREMIUM"
  | "PJ_START" | "PJ_PRO" | "PJ_BUSINESS";

interface PlanDef {
  label:    string;
  price:    string;
  type:     "PF" | "PJ";
  users:    string;
  numbers:  string;
  ai:       string;
  features: string[];
  highlight?: boolean;
}

const PLANS: Record<PlanKey, PlanDef> = {
  PF_BASIC:    { label: "PF Básico",    price: "R$ 19,90",  type: "PF", users: "1 usuário",         numbers: "1 número WhatsApp",   ai: "Lançamento por texto",              features: ["Relatórios essenciais", "Metas pessoais"] },
  PF_PLUS:     { label: "PF Plus",      price: "R$ 29,90",  type: "PF", users: "1 usuário",         numbers: "Até 3 números",        ai: "Texto + áudio",                     features: ["Relatórios completos", "Categorias avançadas"], highlight: true },
  PF_PREMIUM:  { label: "PF Premium",   price: "R$ 49,90",  type: "PF", users: "1 usuário",         numbers: "Até 5 números",        ai: "Texto + áudio + comprovante",       features: ["Leitura por IA", "Suporte prioritário"] },
  PJ_START:    { label: "PJ Start",     price: "R$ 59,90",  type: "PJ", users: "Até 3 usuários",    numbers: "Até 2 números",        ai: "Texto + áudio",                     features: ["Centro de custo básico", "Relatórios PJ"] },
  PJ_PRO:      { label: "PJ Pro",       price: "R$ 99,90",  type: "PJ", users: "Até 8 usuários",    numbers: "Até 5 números",        ai: "Texto + áudio + comprovante",       features: ["Automações", "DRE simplificado"], highlight: true },
  PJ_BUSINESS: { label: "PJ Business",  price: "R$ 199,90", type: "PJ", users: "Até 20 usuários",   numbers: "Até 15 números",       ai: "Recursos completos com IA",          features: ["Governança", "Suporte dedicado"] },
};

const PLAN_KEYS = Object.keys(PLANS) as PlanKey[];

function planTypeFromKey(key: PlanKey): "PF" | "PJ" {
  return PLANS[key].type;
}

/** Detecta plano vindo de ?plan=PF_PLUS na query string. */
function detectInitialPlan(): PlanKey {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("plan")?.toUpperCase() as PlanKey | undefined;
  return raw && PLAN_KEYS.includes(raw) ? raw : "PF_PLUS";
}

// ── Steps ─────────────────────────────────────────────────────────────────────

const STEPS = ["Dados", "Plano", "Resumo", "Verificação", "Concluído"];

// ── Componentes internos ──────────────────────────────────────────────────────

function StepHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

function InputField({
  icon, label, placeholder, value, onChange, type = "text", required = false,
  suffix,
}: {
  icon: React.ReactNode; label: string; placeholder: string;
  value: string; onChange: (v: string) => void; type?: string;
  required?: boolean; suffix?: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 transition-colors focus-within:border-primary">
        <span className="text-muted-foreground">{icon}</span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {suffix}
      </div>
    </div>
  );
}

function RowItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-foreground">
      <span className="text-primary">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <p className="text-sm text-destructive">{message}</p>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function CadastroPage() {
  const [step, setStep] = useState(0);

  // Formulário step 0
  const [nome,     setNome]     = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email,    setEmail]    = useState("");
  const [emailCon, setEmailCon] = useState("");
  const [senha,    setSenha]    = useState("");
  const [senhaCon, setSenhaCon] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);

  // Plano
  const [plan, setPlan] = useState<PlanKey>(detectInitialPlan);
  const tipo = planTypeFromKey(plan);
  const plansOfType = PLAN_KEYS.filter((k) => PLANS[k].type === tipo);

  // Verificação
  const [codigo, setCodigo]     = useState("");
  const [regEmail, setRegEmail] = useState("");

  // Estado assíncrono
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Validação step 0
  const step0Valid = useMemo(() => {
    return (
      nome.trim().length > 1 &&
      whatsapp.replace(/\D/g, "").length >= 10 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
      email === emailCon &&
      senha.length >= 6 &&
      senha === senhaCon
    );
  }, [nome, whatsapp, email, emailCon, senha, senhaCon]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleRegister = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await register({
        nome:        nome.trim(),
        email:       email.trim().toLowerCase(),
        senha,
        tipo_perfil: tipo === "PF" ? "fisica" : "juridica",
        nome_perfil: nome.trim(),          // backend requer; pode ser atualizado depois
        telefone:    whatsapp.replace(/\D/g, ""),
      });

      // Salvar plano localmente (backend não persiste plan_type ainda)
      savePendingPlan(plan);

      setRegEmail(res.email);
      setStep(3); // ir para etapa de verificação
    } catch (err) {
      setError((err as ApiError).message || "Erro ao criar conta. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!codigo.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await verify(regEmail, codigo.trim());
      setStep(4);
      setTimeout(() => redirectToApp(res.token, res.user), 2000);
    } catch (err) {
      setError((err as ApiError).message || "Código inválido ou expirado.");
    } finally {
      setLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-soft)" }}>
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <a href="/" className="flex items-center">
            <BrandLogo variant="fluxiva-financeiro" theme="light" markSize={36} />
          </a>
          <a href="/login" className="text-sm font-medium text-muted-foreground hover:text-primary">
            Já tenho conta
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        {/* Stepper */}
        <ol className="mb-10 flex items-center justify-between gap-2">
          {STEPS.map((label, i) => {
            const done   = i < step;
            const active = i === step;
            return (
              <li key={label} className="flex flex-1 items-center gap-2">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold transition-all ${
                  done   ? "border-primary bg-primary text-primary-foreground" :
                  active ? "border-primary text-primary" :
                           "border-border bg-card text-muted-foreground"
                }`}>
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span className={`hidden text-xs font-semibold sm:block ${active || done ? "text-foreground" : "text-muted-foreground"}`}>
                  {label}
                </span>
                {i < STEPS.length - 1 && (
                  <div className={`h-px flex-1 ${done ? "bg-primary" : "bg-border"}`} />
                )}
              </li>
            );
          })}
        </ol>

        <div className="rounded-3xl border border-border bg-card p-8" style={{ boxShadow: "var(--shadow-card)" }}>

          {/* ── Step 0: Dados ─────────────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-5">
              <StepHeader title="Seus dados" desc="Vamos começar com algumas informações." />
              {error && <ErrorBox message={error} />}

              <InputField icon={<User className="h-4 w-4" />}   label="Nome completo"     placeholder="Maria Silva"        value={nome}     onChange={setNome}    required />
              <InputField icon={<Phone className="h-4 w-4" />}  label="WhatsApp"          placeholder="(11) 99999-9999"    value={whatsapp} onChange={setWhatsapp} required />
              <InputField icon={<Mail className="h-4 w-4" />}   label="E-mail"            placeholder="voce@email.com"     value={email}    onChange={setEmail}   type="email" required />
              <InputField icon={<Mail className="h-4 w-4" />}   label="Confirmar e-mail"  placeholder="voce@email.com"     value={emailCon} onChange={setEmailCon} type="email" required />
              {emailCon && email !== emailCon && (
                <p className="text-xs text-destructive">Os e-mails não coincidem.</p>
              )}

              <InputField
                icon={<Lock className="h-4 w-4" />}
                label="Senha (mín. 6 caracteres)"
                placeholder="••••••••"
                value={senha}
                onChange={setSenha}
                type={showPwd ? "text" : "password"}
                required
                suffix={
                  <button type="button" onClick={() => setShowPwd((s) => !s)} className="text-muted-foreground hover:text-foreground">
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
              <InputField icon={<Lock className="h-4 w-4" />} label="Confirmar senha" placeholder="••••••••" value={senhaCon} onChange={setSenhaCon} type={showPwd ? "text" : "password"} required />
              {senhaCon && senha !== senhaCon && (
                <p className="text-xs text-destructive">As senhas não coincidem.</p>
              )}
            </div>
          )}

          {/* ── Step 1: Plano ─────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-6">
              <StepHeader title="Escolha seu plano" desc="Você pode trocar de plano a qualquer momento." />

              {/* Toggle PF/PJ */}
              <div className="flex justify-center">
                <div className="inline-flex rounded-full border border-border bg-background p-1">
                  {(["PF", "PJ"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setPlan(t === "PF" ? "PF_PLUS" : "PJ_PRO")}
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
                {plansOfType.map((key) => {
                  const p = PLANS[key];
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
                      <p className="mt-2 text-2xl font-bold text-foreground">
                        {p.price}
                        <span className="text-xs font-normal text-muted-foreground">/mês</span>
                      </p>
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

          {/* ── Step 2: Resumo ────────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-6">
              <StepHeader title="Resumo do seu pedido" desc="Confira antes de finalizar." />
              {error && <ErrorBox message={error} />}

              <div className="rounded-2xl border border-border bg-background p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Plano escolhido</p>
                    <p className="text-lg font-bold text-foreground">{PLANS[plan].label}</p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
                    {PLANS[plan].price}/mês
                  </span>
                </div>
                <div className="mt-4 grid gap-2">
                  <RowItem icon={<Users className="h-4 w-4" />}     text={PLANS[plan].users} />
                  <RowItem icon={<Smartphone className="h-4 w-4" />} text={PLANS[plan].numbers} />
                  <RowItem icon={<Bot className="h-4 w-4" />}        text={PLANS[plan].ai} />
                  {PLANS[plan].features.map((f) => (
                    <RowItem key={f} icon={<Check className="h-4 w-4" />} text={f} />
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background p-5 text-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Seus dados</p>
                <p className="mt-1 font-semibold text-foreground">{nome || "—"}</p>
                <p className="text-muted-foreground">{email} · {whatsapp}</p>
              </div>
            </div>
          )}

          {/* ── Step 3: Verificação ───────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-6">
              <StepHeader
                title="Verifique seu e-mail"
                desc={`Enviamos um código para ${regEmail}. Digite-o abaixo para ativar sua conta.`}
              />
              {error && <ErrorBox message={error} />}

              <InputField
                icon={<KeyRound className="h-4 w-4" />}
                label="Código de verificação"
                placeholder="Ex: 123456"
                value={codigo}
                onChange={setCodigo}
                required
              />

              <button
                onClick={handleVerify}
                disabled={loading || !codigo.trim()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
                style={{ boxShadow: "var(--shadow-elegant)" }}
              >
                {loading ? "Verificando..." : (<>Verificar e acessar <ArrowRight className="h-4 w-4" /></>)}
              </button>

              <p className="text-center text-xs text-muted-foreground">
                Não recebeu?{" "}
                <a href={`/login`} className="font-medium text-primary hover:underline">
                  Voltar ao login para reenviar
                </a>
              </p>
            </div>
          )}

          {/* ── Step 4: Concluído ─────────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-6 py-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
                   style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
                <MailCheck className="h-8 w-8 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">Conta criada com sucesso!</h2>
                <p className="mt-2 text-muted-foreground">
                  Redirecionando para o sistema financeiro...
                </p>
              </div>
              <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 text-left">
                <p className="text-sm font-semibold text-foreground">
                  <Sparkles className="mr-1 inline h-4 w-4 text-primary" /> Próximos passos
                </p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <li>• Conecte seu número WhatsApp</li>
                  <li>• Faça seu primeiro lançamento</li>
                  <li>• Explore os relatórios</li>
                </ul>
              </div>
            </div>
          )}

          {/* ── Navegação ─────────────────────────────────────────────── */}
          {step < 3 && (
            <div className="mt-8 flex items-center justify-between">
              <button
                onClick={() => { setError(null); setStep((s) => Math.max(0, s - 1)); }}
                disabled={step === 0}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar
              </button>

              <button
                onClick={() => {
                  setError(null);
                  if (step === 2) {
                    handleRegister();
                  } else {
                    setStep((s) => s + 1);
                  }
                }}
                disabled={(step === 0 && !step0Valid) || loading}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-40"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                {loading ? "Aguarde..." : step === 2 ? "Criar conta" : "Continuar"}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
