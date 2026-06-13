import { useMemo, useState } from "react";
import { Calculator, Users, Smartphone, MessageSquare, Mic, Receipt } from "lucide-react";
import { PLAN_CATALOG_LANDING, type PlanCatalogEntry } from "../../data/planCatalog";

type PlanKey = PlanCatalogEntry["slug"];

const PLAN_META: Record<
  PlanKey,
  {
    label: string;
    base: number;
    extraUserRate: number;
    extraNumberRate: number;
    maxUsers: number;
    maxNumbers: number;
    texto: boolean;
    audio: boolean;
    receipt: boolean;
  }
> = Object.fromEntries(
  PLAN_CATALOG_LANDING.map((p) => [
    p.slug,
    {
      label: p.nome,
      base: p.precoCentavos / 100,
      extraUserRate: p.limiteUsuarios <= 1 ? 8 : 12,
      extraNumberRate: p.limiteWhatsappNumeros <= 3 ? 5 : 10,
      maxUsers: p.limiteUsuarios,
      maxNumbers: p.limiteWhatsappNumeros,
      texto: p.whatsappTexto,
      audio: p.whatsappAudio,
      receipt: p.whatsappComprovante,
    },
  ])
) as Record<PlanKey, {
  label: string;
  base: number;
  extraUserRate: number;
  extraNumberRate: number;
  maxUsers: number;
  maxNumbers: number;
  texto: boolean;
  audio: boolean;
  receipt: boolean;
}>;

export function PriceSimulator() {
  const [plan, setPlan] = useState<PlanKey>("pj_pro");
  const meta = PLAN_META[plan];
  const [users, setUsers] = useState(1);
  const [numbers, setNumbers] = useState(1);

  const safeUsers = Math.min(users, meta.maxUsers);
  const safeNumbers = Math.min(numbers, meta.maxNumbers);

  const price = useMemo(() => {
    const extraUsers = Math.max(0, safeUsers - 1) * meta.extraUserRate;
    const extraNumbers = Math.max(0, safeNumbers - 1) * meta.extraNumberRate;
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

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Users className="h-4 w-4" /> Usuários
                </label>
                <input
                  type="range"
                  min={1}
                  max={meta.maxUsers}
                  value={safeUsers}
                  onChange={(e) => setUsers(Number(e.target.value))}
                  className="mt-2 w-full"
                />
                <p className="text-xs text-muted-foreground">
                  {safeUsers} de {meta.maxUsers} incluídos no plano
                </p>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Smartphone className="h-4 w-4" /> Números WhatsApp
                </label>
                <input
                  type="range"
                  min={1}
                  max={meta.maxNumbers}
                  value={safeNumbers}
                  onChange={(e) => setNumbers(Number(e.target.value))}
                  className="mt-2 w-full"
                />
                <p className="text-xs text-muted-foreground">
                  {safeNumbers} de {meta.maxNumbers} números
                </p>
              </div>
            </div>
          </div>

          <div
            className="rounded-2xl border border-border bg-card/80 p-8 backdrop-blur"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <p className="text-sm text-muted-foreground">Estimativa mensal</p>
            <p className="mt-2 text-5xl font-bold text-foreground">
              R$ {price.toFixed(2).replace(".", ",")}
              <span className="text-lg font-medium text-muted-foreground">/mês</span>
            </p>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                Texto {meta.texto ? "incluso" : "—"}
              </li>
              <li className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-primary" />
                Áudio {meta.audio ? "incluso" : "—"}
              </li>
              <li className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                Comprovante {meta.receipt ? "incluso" : "—"}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
