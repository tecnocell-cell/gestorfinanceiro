export default function BetaBadge({ className = "" }) {
  return (
    <span className={`beta-badge ${className}`.trim()} title="Versão beta">
      Beta
    </span>
  );
}
