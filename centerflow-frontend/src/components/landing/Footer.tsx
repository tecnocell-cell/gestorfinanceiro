import { BrandLogo } from "@/components/BrandLogo";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-10 md:flex-row">
        <BrandLogo variant="fluxiva-financeiro" theme="light" markSize={32} />
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Fluxiva. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
