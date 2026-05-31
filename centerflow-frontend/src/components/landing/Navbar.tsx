import { Link } from "@tanstack/react-router";
import { Wallet, Menu, X } from "lucide-react";
import { useState } from "react";

const navLinks = [
  { href: "#produto", label: "Produto" },
  { href: "#recursos", label: "Recursos" },
  { href: "#planos", label: "Planos" },
  { href: "#simulador", label: "Simulador" },
  { href: "#faq", label: "FAQ" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-primary/20"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
          >
            <Wallet className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight text-foreground">
            Fluxiva <span className="text-primary">Financeiro</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="relative transition-colors hover:text-foreground after:absolute after:bottom-[-6px] after:left-0 after:h-[2px] after:w-0 after:bg-primary after:transition-all hover:after:w-full"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/login"
            className="hidden text-sm font-medium text-foreground transition-colors hover:text-primary sm:inline-block"
          >
            Entrar
          </Link>
          <Link
            to="/cadastro"
            className="hidden rounded-full px-5 py-2 text-sm font-semibold text-primary-foreground transition-all hover:scale-[1.03] sm:inline-flex"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-card)" }}
          >
            Criar conta grátis
          </Link>

          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground md:hidden"
            aria-label="Abrir menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-background/95 backdrop-blur-xl md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-2 flex gap-2 border-t border-border pt-3">
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-full border border-border px-4 py-2.5 text-center text-sm font-semibold text-foreground"
              >
                Entrar
              </Link>
              <Link
                to="/cadastro"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-full px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground"
                style={{ background: "var(--gradient-primary)" }}
              >
                Criar conta
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
