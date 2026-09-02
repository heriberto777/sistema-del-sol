import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

interface CarritoDrawerState {
  abierto: boolean;
  abrir: () => void;
  cerrar: () => void;
}

const CarritoDrawerContext = createContext<CarritoDrawerState | null>(null);

/**
 * Estado de UI puro (¿está abierto el panel de carrito?) — sin lógica de
 * negocio, que sigue viviendo en `useCarritoTienda`. Provisto una sola vez
 * en `TiendaLayout` para que el `Nav` de cualquier plantilla pueda abrirlo.
 */
export function CarritoDrawerProvider({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const valor = useMemo<CarritoDrawerState>(
    () => ({ abierto, abrir: () => setAbierto(true), cerrar: () => setAbierto(false) }),
    [abierto],
  );
  return <CarritoDrawerContext.Provider value={valor}>{children}</CarritoDrawerContext.Provider>;
}

export function useCarritoDrawer(): CarritoDrawerState {
  const ctx = useContext(CarritoDrawerContext);
  if (!ctx) throw new Error('useCarritoDrawer debe usarse dentro de CarritoDrawerProvider (TiendaLayout)');
  return ctx;
}
