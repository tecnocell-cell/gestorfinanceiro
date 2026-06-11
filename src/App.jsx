import { Component, useState } from 'react';
import { AuthProvider, useAuth } from './gestor/AuthContext.jsx';
import { GestorProvider, useGestor } from './gestor/GestorContext.jsx';
import GestorApp from './gestor/GestorApp.jsx';
import LoginPage from './gestor/pages/LoginPage.jsx';
import RegisterPage from './gestor/pages/RegisterPage.jsx';
import AcceptInvitePage, { isAcceptInviteRoute } from './gestor/pages/AcceptInvitePage.jsx';
import { css } from './gestor/styles.js';

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 560 }}>
          <h1 style={{ fontSize: 18, marginBottom: 8 }}>Erro ao carregar o app</h1>
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>
            Recarregue a página (Ctrl+F5). Se persistir, reinicie o servidor com{' '}
            <code>npm run dev</code>.
          </p>
          <pre style={{ fontSize: 12, background: '#f1f5f9', padding: 12, borderRadius: 8, overflow: 'auto' }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function LoadingScreen() {
  return (
    <>
      <style>{css}</style>
      <div className="loading-screen">
        <div className="loading-logo">CT</div>
        <div className="loading-spinner" />
        <p className="loading-text">Carregando dados…</p>
      </div>
    </>
  );
}

function AppWithLoading() {
  const { appLoading } = useGestor();
  if (appLoading) return <LoadingScreen />;
  return <GestorApp />;
}

function parseCadastroRoute() {
  // Path-based: /cadastro?phone=xxx&source=whatsapp  (landing page)
  const path = window.location.pathname || "";
  if (path === "/cadastro" || path.startsWith("/cadastro?")) {
    const params = new URLSearchParams(window.location.search || "");
    return { phone: params.get("phone") || "", source: params.get("source") || "" };
  }
  // Hash-based: /#/cadastro?phone=xxx&source=whatsapp  (fallback / SPA interno)
  const hash = window.location.hash || "";
  if (hash.startsWith("#/cadastro")) {
    const qIdx = hash.indexOf("?");
    if (qIdx < 0) return { phone: "", source: "" };
    const params = new URLSearchParams(hash.slice(qIdx + 1));
    return { phone: params.get("phone") || "", source: params.get("source") || "" };
  }
  return null;
}

function AuthScreen() {
  const cadastro = parseCadastroRoute();
  const [mode, setMode] = useState(cadastro ? 'register' : 'login');
  const { setSession } = useAuth();

  if (mode === 'register') {
    return (
      <RegisterPage
        onLogin={() => setMode('login')}
        onVerified={(data) => setSession(data.token, data.user)}
        initialPhone={cadastro?.phone || ""}
        whatsappSource={cadastro?.source || ""}
      />
    );
  }

  return <LoginPage onRegister={() => setMode('register')} />;
}

function AppInner() {
  const { token, profileReady } = useAuth();

  if (isAcceptInviteRoute()) {
    return <AcceptInvitePage />;
  }

  if (!token) return <AuthScreen />;
  if (!profileReady) return <LoadingScreen />;

  return (
    <GestorProvider>
      <AppWithLoading />
    </GestorProvider>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </AppErrorBoundary>
  );
}
