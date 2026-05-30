/**
 * landing-spa/Navbar.tsx
 * Versão da Navbar para o build SPA — usa <a> em vez de TanStack Link.
 */
import { Wallet } from "lucide-react";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <a href="/" className="flex items-center gap-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Wallet className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight text-foreground">
            CenterFlow <span className="text-primary">Financeiro</span>
          </span>
        </a>

        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
          <a href="#produto"    className="transition-colors hover:text-foreground">Produto</a>
          <a href="#recursos"   className="transition-colors hover:text-foreground">Recursos</a>
          <a href="#planos"     className="transition-colors hover:text-foreground">Planos</a>
          <a href="#simulador"  className="transition-colors hover:text-foreground">Simulador</a>
          <a href="#faq"        className="transition-colors hover:text-foreground">FAQ</a>
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="/login"
            className="text-sm font-medium text-foreground transition-colors hover:text-primary"
          >
            Entrar
          </a>
          <a
            href="/cadastro"
            className="hidden rounded-full px-5 py-2 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 sm:inline-flex"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-card)" }}
          >
            Começar grátis
          </a>
        </div>
      </div>
    </header>
  );
}
