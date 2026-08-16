import { createContext, ReactNode, useCallback, useMemo, useState } from 'react';
import { platformApiClient } from '../lib/platform-api-client';

export interface PlatformAdminAutenticado {
  id: string;
  nombre: string;
  email: string;
}

interface PlatformAuthContextValue {
  admin: PlatformAdminAutenticado | null;
  cargando: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
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

  const value = useMemo(() => ({ admin, cargando, login, logout }), [admin, cargando, login, logout]);

  return <PlatformAuthContext.Provider value={value}>{children}</PlatformAuthContext.Provider>;
}
