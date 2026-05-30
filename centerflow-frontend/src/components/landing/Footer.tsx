import { Wallet } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-10 md:flex-row">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--gradient-primary)" }}>
            <Wallet className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold text-foreground">CenterFlow Financeiro</span>
        </div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} CenterFlow. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
