import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
// Deliberately local: no Supabase credentials, public API or auth bypass in production.
export default defineConfig({
  root: "static",
  envDir: false,
  publicDir: "../public",
  plugins: [react()],
  resolve: {
    alias: { "/src": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    host: "127.0.0.1",
    port: 4310,
    strictPort: true,
    proxy: {
      "/api/operations": {
        target: "http://127.0.0.1:4311",
        changeOrigin: true,
      },
    },
  },
});
