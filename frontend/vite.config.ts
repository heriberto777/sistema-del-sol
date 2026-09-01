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
    // Sin esto, cada `vite build` corrido en el host (ej. verificación
    // antes de commitear) escribe en frontend/dist/ — que cae dentro
    // del mismo volumen montado que ve el contenedor `web` — y el
    // watcher del dev server lo toma como cambio de archivos, reinicia
    // y fuerza un full-reload del navegador sin ningún error real de
    // por medio (se veía como "el navegador se queda reiniciando").
    watch: {
      ignored: ['**/dist/**'],
    },
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
