import { createContext, ReactNode, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../hooks/useAuth';

interface Sucursal {
  id: string;
  nombre: string;
}

interface SucursalActivaContextValue {
  sucursales: Sucursal[];
  sucursalActivaId: string | null;
  setSucursalActiva: (id: string | null) => void;
}

export const SucursalActivaContext = createContext<SucursalActivaContextValue | undefined>(undefined);

const STORAGE_KEY = 'sol_sucursal_activa';

/**
 * Híbrido entre AuthContext (trae la lista real del backend, que
 * respeta la asignación de UsuarioSucursal — Fase 8b) y ThemeContext
 * (persiste la ELECCIÓN del usuario en localStorage, sin round-trip al
 * backend). Puramente UX: no restringe nada por sí solo — Fase 9 es la
 * que le da un enforcement real vía PIN/permisos por sucursal.
 */
export function SucursalActivaProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const [sucursalActivaId, setSucursalActivaIdState] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));

  const { data: sucursales } = useQuery({
    queryKey: ['sucursales-mias'],
    queryFn: async () => (await apiClient.get<Sucursal[]>('/sucursales/mias')).data,
    enabled: !!usuario,
  });

  useEffect(() => {
    if (!sucursales) return;
    if (sucursalActivaId && sucursales.some((s) => s.id === sucursalActivaId)) return;
    // La sucursal guardada ya no está en la lista vigente (o nunca hubo ninguna) — cae a la primera disponible.
    setSucursalActivaIdState(sucursales[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sucursales]);

  function setSucursalActiva(id: string | null) {
    setSucursalActivaIdState(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  const value = useMemo(
    () => ({ sucursales: sucursales ?? [], sucursalActivaId, setSucursalActiva }),
    [sucursales, sucursalActivaId],
  );

  return <SucursalActivaContext.Provider value={value}>{children}</SucursalActivaContext.Provider>;
}
