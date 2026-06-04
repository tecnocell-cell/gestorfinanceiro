import { useState } from 'react';
import { AuthProvider, useAuth } from './gestor/AuthContext.jsx';
import { GestorProvider, useGestor } from './gestor/GestorContext.jsx';
import GestorApp from './gestor/GestorApp.jsx';
import LoginPage from './gestor/pages/LoginPage.jsx';
import RegisterPage from './gestor/pages/RegisterPage.jsx';
import AcceptInvitePage, { isAcceptInviteRoute } from './gestor/pages/AcceptInvitePage.jsx';
import { css } from './gestor/styles.js';

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

function AuthScreen() {
  const [mode, setMode] = useState('login');
  const { setSession } = useAuth();

  if (mode === 'register') {
    return (
      <RegisterPage
        onLogin={() => setMode('login')}
        onVerified={(data) => setSession(data.token, data.user)}
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
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
