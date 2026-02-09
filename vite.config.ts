import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Build configuration for code splitting
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Split vendor chunks by package name
          if (id.includes("node_modules")) {
            // React core
            if (id.includes("react-dom") || id.includes("/react/")) {
              return "vendor-react";
            }
            // React Router
            if (id.includes("react-router")) {
              return "vendor-router";
            }
            // TanStack libraries
            if (id.includes("@tanstack")) {
              return "vendor-tanstack";
            }
            // Radix UI primitives
            if (id.includes("@radix-ui")) {
              return "vendor-radix";
            }
            // Tauri APIs
            if (id.includes("@tauri-apps")) {
              return "vendor-tauri";
            }
            // Icon libraries (these are large)
            if (id.includes("@tabler/icons") || id.includes("lucide-react")) {
              return "vendor-icons";
            }
          }
        },
      },
    },
    // Adjust chunk size warning limit (react-dom is ~350KB, which is expected)
    chunkSizeWarningLimit: 400,
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 61146,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 61147,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
