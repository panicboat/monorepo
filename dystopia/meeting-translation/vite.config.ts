import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/translate/",
  build: {
    outDir: "dist/public",
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
