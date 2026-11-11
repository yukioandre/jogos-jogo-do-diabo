import { defineConfig } from 'vite';

// Em desenvolvimento, o Vite serve o cliente (porta 5173) e encaminha
// /api (WebSocket das salas) para o `wrangler dev` (porta 8787).
export default defineConfig({
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8787', ws: true },
    },
  },
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 800 },
});
