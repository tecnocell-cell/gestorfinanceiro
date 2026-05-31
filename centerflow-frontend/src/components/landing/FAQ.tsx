import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

const faqs = [
  {
    q: "Como funciona o lançamento pelo WhatsApp?",
    a: "Você envia uma mensagem de texto, um áudio ou a foto de um comprovante. Nossa IA interpreta e pergunta SIM/NÃO para confirmar o lançamento.",
  },
  {
    q: "Posso autorizar minha família ou equipe?",
    a: "Sim! De acordo com o plano, você libera 1 a 15 números autorizados para lançar no mesmo financeiro.",
  },
  {
    q: "Os dados ficam seguros?",
    a: "Seus dados são criptografados em trânsito e em repouso. Você é o único dono das informações da sua conta.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim. Sem fidelidade. Cancele direto pelo painel a qualquer momento.",
  },
  {
    q: "PF e PJ no mesmo plano?",
    a: "Os planos são separados, mas você pode ter ambos na mesma conta Fluxiva.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="mx-auto max-w-4xl px-4 py-20 sm:px-6 md:py-24">
      <div className="mb-10 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-xs font-semibold text-primary">
          <HelpCircle className="h-3.5 w-3.5" /> Dúvidas frequentes
        </span>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Perguntas frequentes
        </h2>
        <p className="mt-3 text-muted-foreground">Tudo que você precisa saber antes de começar.</p>
      </div>
      <div className="space-y-3">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <div
              key={f.q}
              className={`overflow-hidden rounded-2xl border bg-card transition-all ${
                isOpen ? "border-primary/30" : "border-border"
              }`}
              style={{ boxShadow: isOpen ? "var(--shadow-card-hover)" : "var(--shadow-card)" }}
            >
              <button
                onClick={() => setOpen(isOpen ? -1 : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left sm:px-6"
              >
                <span className="text-sm font-semibold text-foreground sm:text-base">{f.q}</span>
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all ${
                    isOpen ? "rotate-180 bg-primary text-primary-foreground" : "bg-secondary text-primary"
                  }`}
                >
                  <ChevronDown className="h-4 w-4" />
                </div>
              </button>
              <div
                className={`grid transition-all duration-300 ease-out ${
                  isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground sm:px-6">{f.a}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
