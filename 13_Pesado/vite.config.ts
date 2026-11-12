import { defineConfig } from 'vite';

// Em desenvolvimento, o Vite serve o cliente (porta 5175) e encaminha
// /api (WebSocket das salas) para o `wrangler dev` (porta 8789).
export default defineConfig({
  server: {
    port: 5175,
    proxy: {
      '/api': { target: 'http://localhost:8789', ws: true },
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
