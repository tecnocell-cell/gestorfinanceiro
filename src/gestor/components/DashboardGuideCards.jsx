/** Cards de orientação pós-onboarding — Etapa 7.1 */

function GuideCard({ title, desc, onClick }) {
  return (
    <button type="button" className="dash-guide-card" onClick={onClick}>
      <div className="dash-guide-card__title">{title}</div>
      <div className="dash-guide-card__desc">{desc}</div>
    </button>
  );
}

export function DashboardGuideCardsPF({ onNavigate }) {
  const go = (page) => () => onNavigate(page);
  return (
    <div className="dash-guide-grid">
      <GuideCard title="Cadastre seu WhatsApp" desc="Lançamentos por mensagem de texto." onClick={go("whatsapp")} />
      <GuideCard title="Primeiro lançamento" desc="Registre receita ou despesa." onClick={go("lancamentos")} />
      <GuideCard title="Importe OFX/CSV" desc="Traga extratos do banco." onClick={go("open-finance")} />
      <GuideCard title="Resumo anual" desc="Veja para onde vai seu dinheiro." onClick={go("resumo-anual")} />
    </div>
  );
}

export function DashboardGuideCardsPJ({ onNavigate, showEquipe }) {
  const go = (page) => () => onNavigate(page);
  return (
    <div className="dash-guide-grid">
      <GuideCard title="Cadastre cliente" desc="Organize receitas por cliente." onClick={go("clientes")} />
      <GuideCard title="Centro de custo" desc="Acompanhe despesas por área." onClick={go("resultado-centro-custo")} />
      {showEquipe && (
        <GuideCard title="Convide equipe" desc="Adicione usuários ao plano." onClick={go("equipe")} />
      )}
      <GuideCard title="Veja o DRE" desc="Resultado do período." onClick={go("dre")} />
    </div>
  );
}
