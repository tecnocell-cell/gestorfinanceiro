import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { ProductShowcase } from "@/components/landing/ProductShowcase";
import { Plans } from "@/components/landing/Plans";
import { PriceSimulator } from "@/components/landing/PriceSimulator";
import { FAQ } from "@/components/landing/FAQ";
import { Footer } from "@/components/landing/Footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CenterFlow Financeiro — Seu financeiro inteligente no WhatsApp" },
      {
        name: "description",
        content:
          "Controle financeiro PF e PJ com lançamentos por texto, áudio e leitura de comprovantes por IA, direto no WhatsApp.",
      },
      { property: "og:title", content: "CenterFlow Financeiro" },
      {
        property: "og:description",
        content: "Financeiro PF/PJ com IA no WhatsApp. Lance por texto, áudio ou foto do comprovante.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <ProductShowcase />
        <Plans />
        <PriceSimulator />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
