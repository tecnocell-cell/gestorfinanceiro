import { useState } from "react";
import { AuthProvider, useAuth } from './gestor/AuthContext.jsx';
import { GestorProvider, useGestor } from './gestor/GestorContext.jsx';
import GestorApp from './gestor/GestorApp.jsx';
import LoginPage from './gestor/pages/LoginPage.jsx';
import AdminPage from './gestor/pages/AdminPage.jsx';

function LoadingScreen() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 16,
      background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 40%, #f0f9ff 100%)",
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        background: "linear-gradient(135deg, #10b981, #0d9488)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20, fontWeight: 800, color: "#fff",
      }}>GF</div>
      <div style={{
        width: 36, height: 36, border: "3px solid #e2e8f0",
        borderTop: "3px solid #10b981", borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>Carregando dados…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function AppWithLoading() {
  const { appLoading } = useGestor();
  if (appLoading) return <LoadingScreen />;
  return <GestorApp />;
}

function AppInner() {
  const { token, isAdmin } = useAuth();

  // Modo local (sem servidor) — flag no localStorage
  const [localMode, setLocalMode] = useState(
    () => localStorage.getItem("gestor_local_mode") === "1"
  );

  const enterLocalMode = () => {
    localStorage.setItem("gestor_local_mode", "1");
    setLocalMode(true);
  };

  // Se logou com conta real, sai do modo local
  if (token && localMode) {
    localStorage.removeItem("gestor_local_mode");
    setLocalMode(false);
  }

  // Sem login e sem modo local → tela de login
  if (!token && !localMode) {
    return <LoginPage onLocalMode={enterLocalMode} />;
  }

  // Admin do sistema → painel de administração (não o app financeiro)
  if (token && isAdmin) {
    return <AdminPage />;
  }

  // Usuário tenant (PF ou PJ) → app financeiro
  return (
    <GestorProvider>
      <AppWithLoading />
    </GestorProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
