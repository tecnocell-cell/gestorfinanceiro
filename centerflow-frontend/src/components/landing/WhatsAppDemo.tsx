import { MessageCircle, Mic, Receipt } from "lucide-react";
import demo1 from "@/assets/whatsapp-demo-1.jpg";
import demo2 from "@/assets/whatsapp-demo-2.jpg";
import demo3 from "@/assets/whatsapp-demo-3.jpg";

const items = [
  {
    src: demo1,
    icon: MessageCircle,
    title: "Lance por texto",
    desc: "Mande uma mensagem no WhatsApp e a IA registra na hora.",
    badge: "Texto",
    accent: "var(--primary)",
  },
  {
    src: demo2,
    icon: Mic,
    title: "Lance por áudio",
    desc: "Grave um áudio e o Fluxiva transcreve e categoriza.",
    badge: "Áudio",
    accent: "var(--accent-violet)",
  },
  {
    src: demo3,
    icon: Receipt,
    title: "Foto do comprovante",
    desc: "Envie a foto da nota e a IA extrai valor e categoria.",
    badge: "Comprovante",
    accent: "var(--accent-amber)",
  },
];

export function WhatsAppDemo() {
  return (
    <section id="demonstracao" className="relative py-20 md:py-24">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            "radial-gradient(50% 40% at 50% 50%, color-mix(in oklab, var(--primary) 10%, transparent), transparent 70%)",
        }}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center md:mb-14">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-xs font-semibold text-primary">
            Demonstração real
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Veja pessoas usando o Fluxiva no WhatsApp
          </h2>
          <p className="mt-4 text-muted-foreground">
            Sem app extra, sem planilha. Tudo acontece na conversa que você já usa todo dia.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {items.map(({ src, icon: Icon, title, desc, badge, accent }) => (
            <div
              key={title}
              className="group overflow-hidden rounded-3xl border border-border bg-card transition-all duration-300 hover:-translate-y-1.5"
              style={{ boxShadow: "var(--shadow-card)" }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "var(--shadow-card-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "var(--shadow-card)")}
            >
              <div className="relative aspect-[4/5] overflow-hidden">
                <img
                  src={src}
                  alt={title}
                  width={1024}
                  height={1280}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

                <div className="absolute left-4 top-4 flex items-center gap-2">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/95 shadow-md backdrop-blur"
                    style={{ color: accent }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-semibold text-white shadow-md backdrop-blur"
                    style={{ background: "rgba(0,0,0,0.4)" }}
                  >
                    {badge}
                  </span>
                </div>

                <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-white/95 p-3 shadow-lg backdrop-blur">
                  <div className="flex items-start gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--gradient-primary)" }}>
                      <MessageCircle className="h-3.5 w-3.5 text-white" />
                    </div>
                    <p className="text-[11px] font-medium text-foreground">
                      Lançamento confirmado no chat
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
