import { useState } from "react";
import { ChevronDown } from "lucide-react";

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
    a: "Os planos são separados, mas você pode ter ambos na mesma conta CenterFlow.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="mx-auto max-w-4xl px-6 py-24">
      <div className="mb-10 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
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
              className="rounded-2xl border border-border bg-card"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <button
                onClick={() => setOpen(isOpen ? -1 : i)}
                className="flex w-full items-center justify-between px-6 py-5 text-left"
              >
                <span className="font-semibold text-foreground">{f.q}</span>
                <ChevronDown
                  className={`h-5 w-5 text-primary transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              {isOpen && <p className="px-6 pb-5 text-sm text-muted-foreground">{f.a}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
