import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }
          if (id.includes("react-router-dom") || id.includes("react-dom") || id.includes("react")) {
            return "react";
          }
          if (id.includes("@tanstack/react-query")) {
            return "query";
          }
          if (id.includes("react-hook-form") || id.includes("@hookform/resolvers") || id.includes("zod")) {
            return "forms";
          }
          if (id.includes("lucide-react")) {
            return "icons";
          }
          return "vendor";
        }
      }
    }
  },
  server: {
    port: 5173
  }
});
