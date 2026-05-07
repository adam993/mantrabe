import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2020",
  },
  server: {
    port: 5173,
    host: true,
    // Don't watch node_modules — chokidar otherwise tries to register
    // an inotify watch per file there and blows past the system file-
    // watcher limit (ENOSPC) before the dev server can finish booting
    watch: {
      ignored: ["**/node_modules/**"],
    },
  },
});
