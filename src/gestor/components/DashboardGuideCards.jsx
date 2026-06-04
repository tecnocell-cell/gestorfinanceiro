/** Cards de orientação pós-onboarding — Etapa 7.1 */

const CARD_STYLE = {
  padding: "14px 16px",
  borderRadius: 12,
  border: "1px solid oklch(0.92 0.02 150)",
  background: "#fff",
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
};

function GuideCard({ title, desc, onClick }) {
  return (
    <button type="button" style={CARD_STYLE} onClick={onClick}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{desc}</div>
    </button>
  );
}

export function DashboardGuideCardsPF({ onNavigate }) {
  const go = (page) => () => onNavigate(page);
  return (
    <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginBottom: 16 }}>
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
    <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginBottom: 16 }}>
      <GuideCard title="Cadastre cliente" desc="Organize receitas por cliente." onClick={go("clientes")} />
      <GuideCard title="Centro de custo" desc="Acompanhe despesas por área." onClick={go("resultado-centro-custo")} />
      {showEquipe && (
        <GuideCard title="Convide equipe" desc="Adicione usuários ao plano." onClick={go("equipe")} />
      )}
      <GuideCard title="Veja o DRE" desc="Resultado do período." onClick={go("dre")} />
    </div>
  );
}
