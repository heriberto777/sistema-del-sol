import type { SubNavTab } from '../../components/molecules/SubNavTabs/SubNavTabs';

// Benchmark 2026-11-09 — "Configuración" ya NO es una pestaña hermana acá:
// se accede solo desde el hub central (/configuracion, "Dominio propio y
// branding"), como página standalone — mismo criterio que Travel
// (`/travel-config` tampoco es una pestaña de "Viajes"). Antes, entrar a
// Configuración desde el hub aterrizaba dentro del `ModuloPestanas` de este
// dominio con estas 3 pestañas visibles, lo que contradecía el propósito
// del hub (pedido explícito del usuario: cada link de Configuración debe
// ser una pantalla limpia, sin el chrome de otro dominio alrededor).
export const TABS_TIENDA_ONLINE: SubNavTab[] = [
  { to: '/tienda-online/secciones', etiqueta: 'Secciones del Home', permiso: 'ecommerce.ver' },
  { to: '/tienda-online/pedidos', etiqueta: 'Pedidos', permiso: 'ecommerce.ver' },
];
