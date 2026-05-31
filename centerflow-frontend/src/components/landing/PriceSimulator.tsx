import { useMemo, useState } from "react";
import { Calculator, Users, Smartphone, Mic, Receipt } from "lucide-react";

type PlanKey = "PF_BASICO" | "PF_PLUS" | "PF_PREMIUM" | "PJ_START" | "PJ_PRO" | "PJ_BUSINESS";

const PLAN_META: Record<PlanKey, { label: string; base: number; type: "PF" | "PJ"; maxUsers: number; maxNumbers: number; audio: boolean; receipt: boolean }> = {
  PF_BASICO:   { label: "PF Básico",   base: 19.9,  type: "PF", maxUsers: 1,  maxNumbers: 1,  audio: false, receipt: false },
  PF_PLUS:     { label: "PF Plus",     base: 29.9,  type: "PF", maxUsers: 1,  maxNumbers: 3,  audio: true,  receipt: false },
  PF_PREMIUM:  { label: "PF Premium",  base: 49.9,  type: "PF", maxUsers: 1,  maxNumbers: 5,  audio: true,  receipt: true  },
  PJ_START:    { label: "PJ Start",    base: 59.9,  type: "PJ", maxUsers: 3,  maxNumbers: 2,  audio: true,  receipt: false },
  PJ_PRO:      { label: "PJ Pro",      base: 99.9,  type: "PJ", maxUsers: 8,  maxNumbers: 5,  audio: true,  receipt: true  },
  PJ_BUSINESS: { label: "PJ Business", base: 199.9, type: "PJ", maxUsers: 20, maxNumbers: 15, audio: true,  receipt: true  },
};

export function PriceSimulator() {
  const [plan, setPlan] = useState<PlanKey>("PF_PLUS");
  const meta = PLAN_META[plan];
  const [users, setUsers] = useState(1);
  const [numbers, setNumbers] = useState(1);

  const safeUsers = Math.min(users, meta.maxUsers);
  const safeNumbers = Math.min(numbers, meta.maxNumbers);

  const price = useMemo(() => {
    const extraUsers = Math.max(0, safeUsers - 1) * (meta.type === "PF" ? 8 : 12);
    const extraNumbers = Math.max(0, safeNumbers - 1) * (meta.type === "PF" ? 5 : 10);
    return meta.base + extraUsers + extraNumbers;
  }, [meta, safeUsers, safeNumbers]);

  return (
    <section id="simulador" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-24">
      <div
        className="relative overflow-hidden rounded-[2rem] border border-border p-6 sm:p-8 md:p-12"
        style={{ background: "var(--gradient-soft)", boxShadow: "var(--shadow-card)" }}
      >
        <div
          className="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full opacity-30 blur-3xl"
          style={{ background: "var(--gradient-primary-soft)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-32 h-64 w-64 rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--accent-sky)" }}
        />

        <div className="relative grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Calculator className="h-3.5 w-3.5" /> Simulador
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Monte seu plano ideal
            </h2>
            <p className="mt-3 text-muted-foreground">
              Ajuste plano, usuários e números do WhatsApp — veja o preço em tempo real.
            </p>

            <div className="mt-8 space-y-6">
              <div>
                <label className="text-sm font-semibold text-foreground">Plano</label>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(Object.keys(PLAN_META) as PlanKey[]).map((k) => (
                    <button
                      key={k}
                      onClick={() => {
                        setPlan(k);
                        setUsers(1);
                        setNumbers(1);
                      }}
                      className={`rounded-xl border px-2 py-2.5 text-xs font-semibold transition-all ${
                        plan === k
                          ? "border-transparent text-primary-foreground shadow-md"
                          : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-secondary"
                      }`}
                      style={plan === k ? { background: "var(--gradient-primary)" } : undefined}
                    >
                      {PLAN_META[k].label}
                    </button>
                  ))}
                </div>
              </div>

              <SliderRow
                icon={<Users className="h-4 w-4" />}
                label="Usuários"
                value={safeUsers}
                min={1}
                max={meta.maxUsers}
                onChange={setUsers}
              />
              <SliderRow
                icon={<Smartphone className="h-4 w-4" />}
                label="Números WhatsApp"
                value={safeNumbers}
                min={1}
                max={meta.maxNumbers}
                onChange={setNumbers}
              />

              <div className="flex flex-wrap gap-2 text-xs">
                <Pill on={meta.audio} icon={<Mic className="h-3 w-3" />} label="Áudio" />
                <Pill on={meta.receipt} icon={<Receipt className="h-3 w-3" />} label="Comprovante (IA)" />
              </div>
            </div>
          </div>

          <div
            className="relative overflow-hidden rounded-3xl p-7 text-center text-white sm:p-8"
            style={{ background: "var(--gradient-dark)", boxShadow: "var(--shadow-elegant)" }}
          >
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full opacity-30 blur-3xl"
              style={{ background: "var(--primary-glow)" }}
            />
            <p className="relative text-sm font-medium uppercase tracking-wider text-white/70">Estimativa mensal</p>
            <p className="relative mt-3 text-5xl font-bold tracking-tight sm:text-6xl">
              <span className="text-2xl font-medium text-white/80 sm:text-3xl">R$ </span>
              {price.toFixed(2).replace(".", ",")}
            </p>
            <p className="relative mt-2 text-sm text-white/70">{meta.label} · cancele quando quiser</p>
            <button
              className="relative mt-6 w-full rounded-full bg-white px-6 py-3.5 text-sm font-bold text-[#063B22] transition-all hover:scale-[1.02] hover:bg-white/95"
            >
              Contratar este plano
            </button>
            <p className="relative mt-4 text-[11px] text-white/60">* Valores ilustrativos para simulação.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function SliderRow({
  icon, label, value, min, max, onChange,
}: { icon: React.ReactNode; label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  const disabled = min === max;
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="text-primary">{icon}</span> {label}
        </span>
        <span className="text-sm font-bold text-primary">{value} <span className="text-muted-foreground font-normal">/ {max}</span></span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-primary disabled:opacity-50"
      />
    </div>
  );
}

function Pill({ on, icon, label }: { on: boolean; icon: React.ReactNode; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 font-semibold ${
        on
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border bg-muted text-muted-foreground line-through"
      }`}
    >
      {icon} {label}
    </span>
  );
}
