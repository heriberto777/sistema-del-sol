// Service worker mínimo — solo para habilitar "instalar app" (PWA, plan de
// integración Cuadre, ítem F-8). Deliberadamente SIN caché: el proyecto no
// tiene modo offline (ver ARCHITECTURE.md, "POS (punto de venta)" — "sin
// modo offline en v1") y un Service Worker que cachee respuestas rompería
// esa garantía sirviendo datos viejos sin que el usuario lo note. Cada
// fetch pasa directo a la red, sin intervención.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
