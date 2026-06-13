import { createFileRoute } from "@tanstack/react-router";
import CadastroPage from "../pages-spa/CadastroPage";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta — Fluxiva Financeiro" },
      { name: "description", content: "Crie sua conta Fluxiva em poucos passos." },
    ],
  }),
  component: CadastroPage,
});
