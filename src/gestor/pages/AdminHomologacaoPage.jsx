import { useState } from "react";
import AdminLayout from "../admin/AdminLayout.jsx";
import AdminSection from "../admin/AdminSection.jsx";
import AdminGoLiveSection from "../admin/AdminGoLiveSection.jsx";
import { BillingHealthPanel } from "../admin/AdminOperacoesBlocks.jsx";

const TABS = [
  { id: "producao", label: "Produção" },
  { id: "beta", label: "Beta fechado" },
  { id: "logs", label: "Logs" },
];

const TAB_HINT = {
  producao: "Checklist de ambiente e cobrança antes de abrir vendas.",
  beta: "Roteiro de testes com usuários PF e PJ no beta fechado.",
  logs: "Eventos recentes de cobrança e integrações.",
};

export default function AdminHomologacaoPage() {
  const [tab, setTab] = useState("producao");

  return (
    <AdminLayout
      title="Homologação"
      subtitle="Validação técnica e comercial antes do go-live. Use as abas para separar produção, beta e auditoria."
    >
      <div className="admin-tabs" role="tablist" aria-label="Homologação">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`admin-tab${tab === t.id ? " admin-tab--active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="admin-tab-hint">{TAB_HINT[tab]}</p>

      {tab === "producao" && (
        <AdminSection title="Diagnóstico de cobrança" description="Resumo do ambiente de assinaturas e faturas.">
          <BillingHealthPanel />
        </AdminSection>
      )}

      <AdminGoLiveSection panel={tab} />
    </AdminLayout>
  );
}
