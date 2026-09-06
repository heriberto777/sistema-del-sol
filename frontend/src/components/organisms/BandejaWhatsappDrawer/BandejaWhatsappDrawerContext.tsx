import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

interface BandejaWhatsappDrawerState {
  abierto: boolean;
  abrir: () => void;
  cerrar: () => void;
}

const BandejaWhatsappDrawerContext = createContext<BandejaWhatsappDrawerState | null>(null);

/**
 * Estado de UI puro (¿está abierto el panel?) — mismo patrón que
 * `CarritoDrawerContext` de la tienda. Provisto una vez en `AppLayout`
 * para que el widget del header y el drawer se coordinen sin prop drilling.
 */
export function BandejaWhatsappDrawerProvider({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const valor = useMemo<BandejaWhatsappDrawerState>(
    () => ({ abierto, abrir: () => setAbierto(true), cerrar: () => setAbierto(false) }),
    [abierto],
  );
  return <BandejaWhatsappDrawerContext.Provider value={valor}>{children}</BandejaWhatsappDrawerContext.Provider>;
}

export function useBandejaWhatsappDrawer(): BandejaWhatsappDrawerState {
  const ctx = useContext(BandejaWhatsappDrawerContext);
  if (!ctx) throw new Error('useBandejaWhatsappDrawer debe usarse dentro de BandejaWhatsappDrawerProvider (AppLayout)');
  return ctx;
}
