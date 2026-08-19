import { createContext, ReactNode, useCallback, useMemo, useState } from 'react';
import { apiClient } from '../lib/api-client';

export interface UsuarioAutenticado {
  id: string;
  nombre: string;
  email: string;
  roles: string[];
  permisos: string[];
  modulosActivos: string[];
  tenant?: { subdominio: string; nombre: string };
}

interface AuthContextValue {
  usuario: UsuarioAutenticado | null;
  cargando: boolean;
  login: (email: string, password: string, tenantSubdominio: string) => Promise<UsuarioAutenticado>;
  logout: () => void;
  /**
   * Solo para UX (ocultar botones/rutas que el usuario no puede usar) — la
   * aplicación real del permiso es 100% responsabilidad del backend
   * (`PermissionsGuard`); esto nunca debe tratarse como una barrera de
   * seguridad por sí sola.
   */
  tienePermiso: (permiso: string) => boolean;
  /**
   * Igual que `tienePermiso`, pero para el plan/excepciones del tenant — solo
   * UX (ocultar del menú), la aplicación real es 100% `ModuloActivoGuard` en
   * el backend.
   */
  tieneModulo: (modulo: string) => boolean;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Tiene acceso al POS pero ninguna visibilidad de la pantalla general de
 * Facturación — hoy es la firma de Cajero Y de Supervisor de Caja (ver
 * docs/ARCHITECTURE.md, "Roles de POS: Cajero, Vendedor, Supervisor de
 * Caja"). Ninguno de los dos tiene reportes.ver, así que el Dashboard
 * les quedaría vacío — por eso ambos aterrizan en /pos al loguearse, sin
 * hardcodear nombres de rol.
 */
export function usaPosComoInicio(usuario: Pick<UsuarioAutenticado, 'permisos'> | null): boolean {
  return !!usuario?.permisos?.includes('pos.editar') && !usuario.permisos.includes('facturacion.ver');
}

/**
 * "Cajero puro": además de `usaPosComoInicio`, NO supervisa otros
 * turnos (`pos.supervisar`) — hoy es exactamente el rol Cajero, nunca
 * Supervisor de Caja/Admin/Gerente. Decide si `Pos.tsx` muestra la vista
 * restringida (solo su propio turno) o la tabla completa de turnos.
 */
export function esCajeroPuro(usuario: Pick<UsuarioAutenticado, 'permisos'> | null): boolean {
  return usaPosComoInicio(usuario) && !usuario?.permisos?.includes('pos.supervisar');
}

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
      return data.usuario as UsuarioAutenticado;
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
  const tieneModulo = useCallback((modulo: string) => usuario?.modulosActivos?.includes(modulo) ?? false, [usuario]);

  const value = useMemo(
    () => ({ usuario, cargando, login, logout, tienePermiso, tieneModulo }),
    [usuario, cargando, login, logout, tienePermiso, tieneModulo],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
