import { createContext, ReactNode, useCallback, useMemo, useState } from 'react';
import { apiClient } from '../lib/api-client';

export interface UsuarioAutenticado {
  id: string;
  nombre: string;
  email: string;
  roles: string[];
  permisos: string[];
}

interface AuthContextValue {
  usuario: UsuarioAutenticado | null;
  cargando: boolean;
  login: (email: string, password: string, tenantSubdominio: string) => Promise<void>;
  logout: () => void;
  /**
   * Solo para UX (ocultar botones/rutas que el usuario no puede usar) — la
   * aplicación real del permiso es 100% responsabilidad del backend
   * (`PermissionsGuard`); esto nunca debe tratarse como una barrera de
   * seguridad por sí sola.
   */
  tienePermiso: (permiso: string) => boolean;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = 'sol_access_token';
const STORAGE_USER_KEY = 'sol_usuario';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioAutenticado | null>(() => {
    const guardado = localStorage.getItem(STORAGE_USER_KEY);
    return guardado ? (JSON.parse(guardado) as UsuarioAutenticado) : null;
  });
  const [cargando, setCargando] = useState(false);

  const login = useCallback(async (email: string, password: string, tenantSubdominio: string) => {
    setCargando(true);
    try {
      const { data } = await apiClient.post('/auth/login', { email, password, tenantSubdominio });
      localStorage.setItem(STORAGE_KEY, data.accessToken);
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(data.usuario));
      setUsuario(data.usuario);
    } finally {
      setCargando(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
    setUsuario(null);
  }, []);

  // `?.permisos?.` (no solo `?.permisos.`) a propósito: una sesión que
  // inició antes de que este campo existiera tiene `usuario` guardado en
  // localStorage sin `permisos` — sin el segundo `?.` esto reventaría con
  // un TypeError en vez de tratarlo como "sin permisos" hasta el próximo login.
  const tienePermiso = useCallback((permiso: string) => usuario?.permisos?.includes(permiso) ?? false, [usuario]);

  const value = useMemo(
    () => ({ usuario, cargando, login, logout, tienePermiso }),
    [usuario, cargando, login, logout, tienePermiso],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
