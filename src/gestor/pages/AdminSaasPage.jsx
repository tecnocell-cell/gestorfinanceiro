import AdminLayout from "../admin/AdminLayout.jsx";
import AdminSection from "../admin/AdminSection.jsx";
import AdminSaasSection from "../admin/AdminSaasSection.jsx";

export default function AdminSaasPage() {
  return (
    <AdminLayout
      title="Gestão SaaS"
      subtitle="Indicadores comerciais (MRR, churn, trials) e alertas de cobrança agregados."
    >
      <AdminSection
        title="Painel comercial"
        description="Métricas estimadas e avisos que exigem ação da equipe."
      >
        <AdminSaasSection mode="saas" />
      </AdminSection>
    </AdminLayout>
  );
}
