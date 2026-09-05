import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

export type ModoTiendaTema = 'claro' | 'oscuro';

interface TiendaTemaState {
  modo: ModoTiendaTema;
  alternar: () => void;
}

const TiendaTemaContext = createContext<TiendaTemaState | null>(null);

// Clave propia — DELIBERADAMENTE separada de `sol_tema` (ThemeContext del
// panel admin). Antes de esto, la tienda pública no tenía tema propio: las
// páginas "shell" (Checkout/Login/Categoría/Productos/etc.) reaccionaban al
// `dark` global del admin (mismo <html>), así que un comprador podía ver el
// Home en la paleta de marca del tenant y el Checkout en "modo oscuro admin"
// sin haber tocado nada — reportado como "salen selecciones en claro y
// oscuro". Con clave propia, la preferencia de un comprador nunca se mezcla
// con la del tenant-admin, ni viceversa.
const CLAVE_STORAGE = 'sol_tienda_tema';

function modoInicial(): ModoTiendaTema {
  try {
    const guardado = localStorage.getItem(CLAVE_STORAGE);
    if (guardado === 'claro' || guardado === 'oscuro') return guardado;
  } catch {
    // localStorage puede no estar disponible (navegación privada) — cae a la preferencia del sistema.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
}

/** Modo claro/oscuro de la tienda pública — provisto una sola vez en `TiendaLayout`, cubre las 7 rutas de tienda. */
export function TiendaTemaProvider({ children }: { children: ReactNode }) {
  const [modo, setModo] = useState<ModoTiendaTema>(modoInicial);

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_STORAGE, modo);
    } catch {
      // Se pierde la persistencia entre visitas, no rompe la sesión actual.
    }
  }, [modo]);

  const valor = useMemo<TiendaTemaState>(
    () => ({ modo, alternar: () => setModo((m) => (m === 'claro' ? 'oscuro' : 'claro')) }),
    [modo],
  );

  return <TiendaTemaContext.Provider value={valor}>{children}</TiendaTemaContext.Provider>;
}

export function useTiendaTema(): TiendaTemaState {
  const ctx = useContext(TiendaTemaContext);
  if (!ctx) throw new Error('useTiendaTema debe usarse dentro de TiendaTemaProvider (TiendaLayout)');
  return ctx;
}
