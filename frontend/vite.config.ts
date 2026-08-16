import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 5173,
    proxy: {
      // VITE_API_PROXY_TARGET la fija docker-compose.yml a
      // http://api:3000 (el nombre del servicio) cuando este Vite corre
      // DENTRO del contenedor `web` — ahí 'localhost' se refiere al
      // propio contenedor, nunca al de `api` (cada uno tiene su propio
      // network namespace), así que localhost:3000 daba ECONNREFUSED
      // siempre, no de forma intermitente.
      // Fuera de Docker (pnpm dev en el host) no hay esa variable, así
      // que cae a 127.0.0.1 explícito — no 'localhost', porque Node
      // resuelve 'localhost' a ::1 (IPv6) primero, y el port-forwarding
      // de Docker Desktop en Windows no responde de forma confiable por
      // IPv6 aunque el mapeo se vea publicado.
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
});
