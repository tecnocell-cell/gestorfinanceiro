import { Wallet, Instagram, Linkedin, Mail } from "lucide-react";

const cols = [
  {
    title: "Produto",
    links: [
      { label: "Recursos", href: "#recursos" },
      { label: "Planos", href: "#planos" },
      { label: "Simulador", href: "#simulador" },
      { label: "Demonstração", href: "#demonstracao" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { label: "FAQ", href: "#faq" },
      { label: "Contato", href: "mailto:contato@fluxiva.app" },
      { label: "Termos de uso", href: "#" },
      { label: "Privacidade", href: "#" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-14">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
              >
                <Wallet className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold text-foreground">
                Fluxiva <span className="text-primary">Financeiro</span>
              </span>
            </div>
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              Seu financeiro inteligente direto no WhatsApp. PF, PJ e IA — tudo na mesma conversa.
            </p>
            <div className="mt-5 flex gap-2">
              {[
                { Icon: Instagram, href: "#", label: "Instagram" },
                { Icon: Linkedin, href: "#", label: "LinkedIn" },
                { Icon: Mail, href: "mailto:contato@fluxiva.app", label: "Email" },
              ].map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {cols.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-foreground">{col.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 md:flex-row">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Fluxiva. Todos os direitos reservados.
          </p>
          <p className="text-xs text-muted-foreground">
            Feito com <span className="text-primary">●</span> para descomplicar suas finanças.
          </p>
        </div>
      </div>
    </footer>
  );
}
