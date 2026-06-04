import { useState } from "react";
import AdminLayout from "../admin/AdminLayout.jsx";
import AdminSection from "../admin/AdminSection.jsx";
import AdminSaasSection from "../admin/AdminSaasSection.jsx";
import { ModalNovoUsuario, ModalResetSenha } from "../admin/AdminUserModals.jsx";

export default function AdminTenantsPage({ onEnterTenant }) {
  const [showNovo, setShowNovo] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);

  return (
    <AdminLayout
      title="Clientes / Tenants"
      subtitle="Lista de contas, planos, cobrança e ações rápidas (entrar como cliente, alterar plano, ver faturas)."
    >
      <AdminSection
        title="Base de clientes"
        description="Filtre por status, busque por nome ou e-mail e abra o detalhe para faturas e equipe."
      >
        <AdminSaasSection
          mode="tenants"
          onEnterTenant={onEnterTenant}
          showNovo={showNovo}
          setShowNovo={setShowNovo}
          ModalNovoUsuario={ModalNovoUsuario}
          ModalResetSenha={ModalResetSenha}
          resetTarget={resetTarget}
          setResetTarget={setResetTarget}
        />
      </AdminSection>
    </AdminLayout>
  );
}
