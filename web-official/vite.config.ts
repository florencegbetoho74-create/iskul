import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Deux entrees, deux bundles.
 *
 * La console d'administration ne fait plus partie du site public : son code
 * n'est plus telecharge par un visiteur, et servie depuis son propre
 * sous-domaine elle obtient une origine distincte de celle du site.
 */
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        console: resolve(__dirname, "console.html"),
      },
    },
  },
  server: {
    port: 5181,
    host: "0.0.0.0",
  },
});
