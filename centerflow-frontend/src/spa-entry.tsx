/**
 * spa-entry.tsx
 *
 * Entry point do build SPA estático da landing CenterFlow.
 * Usa react-router-dom v6 para roteamento client-side.
 * NÃO usa TanStack Start / Router / Nitro.
 *
 * Rotas:
 *   /          → Landing page completa
 *   /login     → Login real (conectado ao backend)
 *   /cadastro  → Cadastro real (conectado ao backend)
 *   /planos    → Landing com scroll para #planos
 *   *          → Redireciona para /
 */

import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./styles.css";

// ── Componentes SPA (sem TanStack Link) ──────────────────────────────────────
import { Navbar }          from "@/components/landing-spa/Navbar";
import { Hero }            from "@/components/landing-spa/Hero";
import { Plans }           from "@/components/landing-spa/Plans";

// ── Componentes puramente presentacionais (sem Link, sem TanStack) ────────────
import { Features }        from "@/components/landing/Features";
import { WhatsAppDemo }    from "@/components/landing/WhatsAppDemo";
import { ProductShowcase } from "@/components/landing/ProductShowcase";
import { PriceSimulator }  from "@/components/landing/PriceSimulator";
import { FAQ }             from "@/components/landing/FAQ";
import { Footer }          from "@/components/landing/Footer";

// ── Páginas com auth real ────────────────────────────────────────────────────
import LoginPage   from "@/pages-spa/LoginPage";
import CadastroPage from "@/pages-spa/CadastroPage";

// ── Landing Page ─────────────────────────────────────────────────────────────

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <WhatsAppDemo />
        <ProductShowcase />
        <Plans />
        <PriceSimulator />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}

/** /planos redireciona para a home e scrolla para #planos */
function PlanosRedirect() {
  React.useEffect(() => {
    window.location.replace("/#planos");
  }, []);
  return null;
}

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"         element={<LandingPage />} />
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/cadastro" element={<CadastroPage />} />
        <Route path="/planos"   element={<PlanosRedirect />} />
        <Route path="*"         element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

// ── Mount ─────────────────────────────────────────────────────────────────────

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
