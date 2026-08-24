import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// PWA instalable (plan de integración Cuadre, ítem F-8) — service worker
// sin caché (ver public/sw.js), solo para habilitar "instalar app". Falla
// silenciosa si el navegador no soporta Service Workers.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
