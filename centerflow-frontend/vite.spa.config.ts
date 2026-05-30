/**
 * vite.spa.config.ts
 *
 * Config Vite para build SPA estático da landing CenterFlow.
 * NÃO usa TanStack Start / Nitro / SSR — Vite puro.
 * Output: ../public-landing/
 *
 * Build:
 *   cd centerflow-frontend
 *   npm install               ← obrigatório na primeira vez
 *   npx vite build --config vite.spa.config.ts
 *
 * Dev:
 *   npx vite --config vite.spa.config.ts
 *   → http://localhost:5174
 *
 * Nota SPA: o servidor (Nginx/Express) deve servir index.html para
 * qualquer rota (/, /login, /cadastro) — o roteamento é client-side
 * via react-router-dom BrowserRouter.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],

  root: ".",

  build: {
    outDir: "../public-landing",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "index.spa.html"),
    },
  },

  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },

  // Dev server — porta separada do app principal (5173)
  server: {
    port: 5174,
    strictPort: false,
  },
});
