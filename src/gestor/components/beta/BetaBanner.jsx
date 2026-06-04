import BetaBadge from "./BetaBadge.jsx";

export default function BetaBanner({ message }) {
  if (!message) return null;
  return (
    <div className="beta-banner" role="status">
      <BetaBadge />
      <p className="beta-banner-text">{message}</p>
    </div>
  );
}
