import { Wallet } from "./icons.jsx";

const GRADIENT = "linear-gradient(135deg, #063B22 0%, #128547 55%, #1FA85A 100%)";

export function BrandMark({ size = 36, className = "" }) {
  const icon = Math.round(size * 0.52);
  return (
    <div
      className={`brand-mark-circle ${className}`.trim()}
      style={{ width: size, height: size, background: GRADIENT }}
      aria-hidden="true"
    >
      <Wallet size={icon} strokeWidth={2.2} />
    </div>
  );
}

export function BrandLogo({
  variant = "fluxiva",
  theme = "dark",
  markSize = 36,
  className = "",
}) {
  const isDark = theme === "dark";

  return (
    <div className={`brand-logo-row ${className}`.trim()}>
      <BrandMark size={markSize} />
      {variant === "fluxiva-financeiro" ? (
        <span className={isDark ? "brand-logo-title brand-logo-title--dark" : "brand-logo-title brand-logo-title--light"}>
          Fluxiva <span className="brand-logo-accent">Financeiro</span>
        </span>
      ) : (
        <span className={isDark ? "brand-logo-title brand-logo-title--dark" : "brand-logo-title brand-logo-title--light"}>
          Fluxiva
        </span>
      )}
    </div>
  );
}
