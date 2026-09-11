import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  base: "/translate/",
  root: "src/web",
  build: {
    outDir: resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  plugins: [react()],
  server: {
    proxy: {
      "/translate/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/translate/ws": {
        target: "http://localhost:3001",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
