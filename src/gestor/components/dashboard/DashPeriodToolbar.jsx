import { LayoutDashboard } from "../icons.jsx";
import { useGestor } from "../../GestorContext.jsx";
import { MESES } from "../../constants.js";

export default function DashPeriodToolbar({ title = "Visão geral", subtitle, icon: Icon = LayoutDashboard }) {
  const { filterPeriodo, setFilterPeriodo } = useGestor();

  return (
    <div className="dash-hero-toolbar">
      <div className="dash-hero-heading">
        <span className="dash-hero-heading-icon" aria-hidden>
          <Icon size={20} strokeWidth={1.75} />
        </span>
        <div>
          <div className="dash-hero-label">{title}</div>
          {subtitle && <div className="dash-hero-sub">{subtitle}</div>}
        </div>
      </div>
      <div className="period-selector period-selector--dash">
        <span>Período</span>
        <select
          value={filterPeriodo.ano}
          onChange={(e) => setFilterPeriodo((p) => ({ ...p, ano: e.target.value }))}
          aria-label="Ano"
        >
          {["2023", "2024", "2025", "2026", "2027"].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select
          value={filterPeriodo.mes}
          onChange={(e) => setFilterPeriodo((p) => ({ ...p, mes: e.target.value }))}
          aria-label="Mês"
        >
          <option value="">Todos os meses</option>
          {MESES.map((m, i) => (
            <option key={m} value={(i + 1).toString().padStart(2, "0")}>{m}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
