import { defineConfig } from 'vite';

// Em desenvolvimento, o Vite serve o cliente (porta 5176) e encaminha
// /api (WebSocket das salas) para o `wrangler dev` (porta 8790).
export default defineConfig({
  server: {
    port: 5176,
    proxy: {
      '/api': { target: 'http://localhost:8790', ws: true },
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
