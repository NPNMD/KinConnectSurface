import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: "client",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "./shared"),
      "@server": path.resolve(__dirname, "./server"),
    },
  },
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    headers: {
      // Disable Cross-Origin-Opener-Policy to allow Firebase OAuth popups
      'Cross-Origin-Opener-Policy': 'unsafe-none',
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
    },
    proxy: (() => {
      const useFunctionsEmulator = process.env.USE_FUNCTIONS_EMULATOR === '1';
      if (useFunctionsEmulator) {
        return {
          "/api": {
            target: "http://127.0.0.1:5001",
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, "/claritystream-uldp9/us-central1/api"),
          },
        };
      }
      return {
        "/api": {
          target: "http://localhost:5000",
          changeOrigin: true,
        },
      };
    })(),
  },
});
