/**
 * vite.spa.config.ts
 *
 * Config para build SPA estático da landing CenterFlow.
 * NÃO usa TanStack Start / Nitro / SSR.
 * Gera: ../public-landing/
 *
 * Build:
 *   cd centerflow-frontend
 *   npx vite build --config vite.spa.config.ts
 *
 * Dev:
 *   npx vite --config vite.spa.config.ts
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
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

  server: {
    port: 5174,
    strictPort: false,
    // Em dev, qualquer path serve index.spa.html (SPA fallback)
    historyApiFallback: true,
  } as any,
});
