import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // vendor chunks change rarely, so they stay cached across deploys
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/.test(id)) return "react";
          if (/[\\/](motion|framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return "motion";
          return "vendor";
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: process.env.API_TARGET ?? "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
