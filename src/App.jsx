import { AuthProvider, useAuth } from './gestor/AuthContext.jsx';
import { GestorProvider, useGestor } from './gestor/GestorContext.jsx';
import GestorApp from './gestor/GestorApp.jsx';
import LoginPage from './gestor/pages/LoginPage.jsx';

function LoadingScreen() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 16,
      background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 40%, #f0f9ff 100%)",
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 15,
        background: "linear-gradient(135deg, #10b981, #0d9488)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, fontWeight: 800, color: "#fff",
      }}>GF</div>
      <div style={{
        width: 34, height: 34, border: "3px solid #e2e8f0",
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
  const { token } = useAuth();

  // Sem token → tela de login (sem modo local)
  if (!token) return <LoginPage />;

  // Admin ou tenant → mesma shell (GestorApp gerencia o painel admin no sidebar)
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
