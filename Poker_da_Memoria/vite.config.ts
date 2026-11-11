import { defineConfig } from 'vite';

// Em desenvolvimento, o Vite serve o cliente (porta 5174) e encaminha
// /api (WebSocket das salas) para o `wrangler dev` (porta 8788).
export default defineConfig({
  server: {
    port: 5174,
    proxy: {
      '/api': { target: 'http://localhost:8788', ws: true },
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
