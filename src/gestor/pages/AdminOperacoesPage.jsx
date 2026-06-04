import AdminLayout from "../admin/AdminLayout.jsx";
import AdminSection from "../admin/AdminSection.jsx";
import {
  OperacoesOverview,
  WhatsAppAdminPanel,
} from "../admin/AdminOperacoesBlocks.jsx";

export default function AdminOperacoesPage() {
  return (
    <AdminLayout
      title="Operações"
      subtitle="Saúde da plataforma, suporte e canal WhatsApp oficial — sem acesso aos lançamentos dos clientes."
    >
      <AdminSection
        title="Visão da plataforma"
        description="Cadastros, uso e demandas de suporte nos últimos períodos."
      >
        <OperacoesOverview />
      </AdminSection>

      <AdminSection
        title="WhatsApp do sistema"
        description="Instância global usada pelo produto (avisos e integrações). Configuração separada do WhatsApp de cada cliente."
      >
        <WhatsAppAdminPanel />
      </AdminSection>
    </AdminLayout>
  );
}
