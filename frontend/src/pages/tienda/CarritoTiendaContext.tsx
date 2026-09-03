import { createContext, ReactNode, useContext } from 'react';
import { CarritoTienda, useCarritoTienda } from '../../hooks/useCarritoTienda';
import { useClienteTienda } from '../../hooks/useClienteTienda';

const CarritoTiendaContext = createContext<CarritoTienda | null>(null);

/**
 * Una sola instancia de `useCarritoTienda` compartida entre todas las
 * páginas de tienda Y el drawer (Fase 9) — antes cada página creaba la
 * suya propia (sin problema mientras el carrito solo se veía en esa
 * misma página); con el drawer viviendo en `TiendaLayout` como hermano
 * del `Outlet`, dos instancias independientes divergían (localStorage
 * se actualizaba bien, pero el estado de React de una no se enteraba de
 * los cambios de la otra). Provisto una sola vez acá.
 *
 * Fase 16 — también resuelve acá el `token` de `useClienteTienda` (si
 * hay sesión) y se lo pasa a `useCarritoTienda` para la sincronización
 * con la base de datos — un solo lugar, en vez de que cada plantilla
 * tenga que acordarse de conectarlo.
 */
export function CarritoTiendaProvider({ subdominio, children }: { subdominio: string; children: ReactNode }) {
  const { token } = useClienteTienda(subdominio);
  const carrito = useCarritoTienda(subdominio, token);
  return <CarritoTiendaContext.Provider value={carrito}>{children}</CarritoTiendaContext.Provider>;
}

export function useCarritoTiendaContext(): CarritoTienda {
  const ctx = useContext(CarritoTiendaContext);
  if (!ctx) throw new Error('useCarritoTiendaContext debe usarse dentro de CarritoTiendaProvider (TiendaLayout)');
  return ctx;
}
