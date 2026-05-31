import { memo } from "react";
import { Sparkles, TrendingUp, TrendingDown, Hourglass, CircleDollarSign } from "../icons.jsx";

/**
 * ResumoInteligente — widget de insights automáticos (Etapa 4.2).
 *
 * Não chama API nem usa IA. Recebe uma lista de bullets já calculados
 * pelas páginas Dashboard (PF / PJ) a partir de dados já existentes.
 *
 * Props:
 *  - items: Array<{ tone: 'success'|'danger'|'warning'|'info'|'neutral', text: string, icon?: 'up'|'down'|'time'|'money' }>
 *  - title?: string
 */
const ICONS = {
  up:    TrendingUp,
  down:  TrendingDown,
  time:  Hourglass,
  money: CircleDollarSign,
};

function ResumoInteligente({ items = [], title = "Resumo do período" }) {
  if (!items.length) return null;
  return (
    <div className="dash-resumo-card" role="status">
      <div className="dash-resumo-header">
        <span className="dash-resumo-icon" aria-hidden>
          <Sparkles size={15} strokeWidth={1.85} />
        </span>
        <div>
          <div className="dash-resumo-title">{title}</div>
          <div className="dash-resumo-sub">{items.length} insight{items.length !== 1 ? "s" : ""} automáticos</div>
        </div>
      </div>
      <ul className="dash-resumo-list">
        {items.map((it, idx) => {
          const Ico = it.icon ? ICONS[it.icon] : null;
          return (
            <li key={idx} className={`dash-resumo-item dash-resumo-item--${it.tone || "neutral"}`}>
              <span className="dash-resumo-bullet" aria-hidden>
                {Ico ? <Ico size={13} strokeWidth={2} /> : <span className="dash-resumo-dot" />}
              </span>
              <span className="dash-resumo-text">{it.text}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default memo(ResumoInteligente);
