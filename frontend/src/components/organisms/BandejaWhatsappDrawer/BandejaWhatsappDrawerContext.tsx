import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

interface BandejaWhatsappDrawerState {
  abierto: boolean;
  /** Si `abrir(telefono)` lo pasó, el drawer arranca directo en esa conversación en vez de la lista (ver toast de aviso urgente). */
  telefonoInicial: string | null;
  abrir: (telefono?: string) => void;
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
  const [telefonoInicial, setTelefonoInicial] = useState<string | null>(null);
  const valor = useMemo<BandejaWhatsappDrawerState>(
    () => ({
      abierto,
      telefonoInicial,
      abrir: (telefono) => {
        setTelefonoInicial(telefono ?? null);
        setAbierto(true);
      },
      cerrar: () => setAbierto(false),
    }),
    [abierto, telefonoInicial],
  );
  return <BandejaWhatsappDrawerContext.Provider value={valor}>{children}</BandejaWhatsappDrawerContext.Provider>;
}

export function useBandejaWhatsappDrawer(): BandejaWhatsappDrawerState {
  const ctx = useContext(BandejaWhatsappDrawerContext);
  if (!ctx) throw new Error('useBandejaWhatsappDrawer debe usarse dentro de BandejaWhatsappDrawerProvider (AppLayout)');
  return ctx;
}
