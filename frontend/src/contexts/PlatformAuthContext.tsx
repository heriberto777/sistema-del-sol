import { createContext, ReactNode, useCallback, useMemo, useState } from 'react';
import { platformApiClient } from '../lib/platform-api-client';

export interface PlatformAdminAutenticado {
  id: string;
  nombre: string;
  email: string;
  permisos: string[];
}

interface PlatformAuthContextValue {
  admin: PlatformAdminAutenticado | null;
  cargando: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** Solo UX (ocultar del header) — la aplicación real es 100% PlatformPermissionsGuard en el backend. */
  tienePermiso: (permiso: string) => boolean;
}

export const PlatformAuthContext = createContext<PlatformAuthContextValue | undefined>(undefined);

const STORAGE_TOKEN_KEY = 'sol_platform_token';
const STORAGE_ADMIN_KEY = 'sol_platform_admin';

export function PlatformAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<PlatformAdminAutenticado | null>(() => {
    const guardado = localStorage.getItem(STORAGE_ADMIN_KEY);
    return guardado ? (JSON.parse(guardado) as PlatformAdminAutenticado) : null;
  });
  const [cargando, setCargando] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setCargando(true);
    try {
      const { data } = await platformApiClient.post('/platform/auth/login', { email, password });
      localStorage.setItem(STORAGE_TOKEN_KEY, data.accessToken);
      localStorage.setItem(STORAGE_ADMIN_KEY, JSON.stringify(data.admin));
      setAdmin(data.admin);
    } finally {
      setCargando(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_ADMIN_KEY);
    setAdmin(null);
  }, []);

  const tienePermiso = useCallback((permiso: string) => admin?.permisos?.includes(permiso) ?? false, [admin]);

  const value = useMemo(
    () => ({ admin, cargando, login, logout, tienePermiso }),
    [admin, cargando, login, logout, tienePermiso],
  );

  return <PlatformAuthContext.Provider value={value}>{children}</PlatformAuthContext.Provider>;
}
