import { defineConfig } from 'vite';

export default defineConfig({
  // Use relative base so the bundle works under file:// (Electron, Capacitor)
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
  },
  server: {
    port: 5173,
    host: true,
  },
});
