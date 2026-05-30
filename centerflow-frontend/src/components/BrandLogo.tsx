import { Wallet } from "lucide-react";

const GRADIENT = "var(--gradient-primary)";

export function BrandMark({
  size = 36,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const icon = Math.round(size * 0.52);
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{ width: size, height: size, background: GRADIENT }}
      aria-hidden="true"
    >
      <Wallet className="text-primary-foreground" style={{ width: icon, height: icon }} strokeWidth={2.2} />
    </div>
  );
}

type BrandLogoProps = {
  /** Painel/login: só Fluxiva. Landing: Fluxiva Financeiro. */
  variant?: "fluxiva" | "fluxiva-financeiro";
  /** light = texto escuro (navbar). dark = texto branco (painel verde). */
  theme?: "light" | "dark";
  markSize?: number;
  className?: string;
};

export function BrandLogo({
  variant = "fluxiva-financeiro",
  theme = "light",
  markSize = 36,
  className = "",
}: BrandLogoProps) {
  const isDark = theme === "dark";
  const titleClass = isDark
    ? "text-lg font-bold tracking-tight text-white"
    : "text-lg font-bold tracking-tight text-foreground";
  const financeiroClass = isDark ? "text-white/90" : "text-primary";

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <BrandMark size={markSize} />
      {variant === "fluxiva-financeiro" ? (
        <span className={titleClass}>
          Fluxiva <span className={financeiroClass}>Financeiro</span>
        </span>
      ) : (
        <span className={titleClass}>Fluxiva</span>
      )}
    </div>
  );
}
