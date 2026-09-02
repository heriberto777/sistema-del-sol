import { createContext, ReactNode, useContext } from 'react';
import { CarritoTienda, useCarritoTienda } from '../../hooks/useCarritoTienda';

const CarritoTiendaContext = createContext<CarritoTienda | null>(null);

/**
 * Una sola instancia de `useCarritoTienda` compartida entre todas las
 * páginas de tienda Y el drawer (Fase 9) — antes cada página creaba la
 * suya propia (sin problema mientras el carrito solo se veía en esa
 * misma página); con el drawer viviendo en `TiendaLayout` como hermano
 * del `Outlet`, dos instancias independientes divergían (localStorage
 * se actualizaba bien, pero el estado de React de una no se enteraba de
 * los cambios de la otra). Provisto una sola vez acá.
 */
export function CarritoTiendaProvider({ subdominio, children }: { subdominio: string; children: ReactNode }) {
  const carrito = useCarritoTienda(subdominio);
  return <CarritoTiendaContext.Provider value={carrito}>{children}</CarritoTiendaContext.Provider>;
}

export function useCarritoTiendaContext(): CarritoTienda {
  const ctx = useContext(CarritoTiendaContext);
  if (!ctx) throw new Error('useCarritoTiendaContext debe usarse dentro de CarritoTiendaProvider (TiendaLayout)');
  return ctx;
}
