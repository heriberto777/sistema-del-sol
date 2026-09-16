import { createContext, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

/** Cada cuánto se refresca sola la sesión (permisos/módulos) mientras la pestaña sigue abierta — ver `refrescarSesion`. */
const INTERVALO_REFRESCO_MS = 5 * 60 * 1000;

export interface UsuarioAutenticado {
  id: string;
  nombre: string;
  email: string;
  roles: string[];
  permisos: string[];
  modulosActivos: string[];
  /** Fase 9 — solo para decidir si el frontend muestra el modal de PIN en acciones sensibles; la validación real es 100% del backend. */
  tienePin?: boolean;
  /** Ítem D-1 — solo para decidir si el frontend muestra el flujo de "solicitar código de autorización" en anular/devolver; la validación real es 100% del backend. */
  requiereAutorizacionAnular?: boolean;
  requiereAutorizacionDevolucion?: boolean;
  tenant?: { subdominio: string; nombre: string; logo?: string | null };
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
  /** Fase 9 — actualiza `tienePin` localmente tras configurar/eliminar el PIN, sin esperar al próximo login. */
  actualizarTienePin: (tienePin: boolean) => void;
  /** Reemite el token/usuario con permisos y módulos al día, sin pedir contraseña — se llama sola (ver AuthProvider), pero queda expuesta por si hace falta un botón manual "Actualizar sesión". */
  refrescarSesion: () => Promise<void>;
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
// Debe coincidir con SucursalActivaContext.tsx (`STORAGE_KEY` ahí) — no se
// importa directo para evitar un ciclo (SucursalActivaContext ya importa
// useAuth, que depende de este archivo). Sin este cleanup, en una compu
// compartida el siguiente usuario que loguea heredaba la sucursal elegida
// por el anterior.
const STORAGE_SUCURSAL_ACTIVA_KEY = 'sol_sucursal_activa';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [usuario, setUsuario] = useState<UsuarioAutenticado | null>(() => {
    const guardado = localStorage.getItem(STORAGE_USER_KEY);
    return guardado ? (JSON.parse(guardado) as UsuarioAutenticado) : null;
  });
  const [cargando, setCargando] = useState(false);

  const login = useCallback(
    async (email: string, password: string, tenantSubdominio: string) => {
      setCargando(true);
      try {
        const { data } = await apiClient.post('/auth/login', { email, password, tenantSubdominio });
        // Sin esto, cualquier query cacheada de una sesión anterior en esta
        // misma pestaña (otro tenant, u otro usuario del mismo tenant)
        // seguía sirviéndose bajo la misma queryKey (ninguna lleva el
        // tenantId adentro) hasta que se revalidara sola — bug real
        // reportado: la config de WhatsApp de un tenant aparecía en otro
        // tras loguearse de nuevo sin recargar la página.
        queryClient.clear();
        localStorage.setItem(STORAGE_KEY, data.accessToken);
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(data.usuario));
        setUsuario(data.usuario);
        return data.usuario as UsuarioAutenticado;
      } finally {
        setCargando(false);
      }
    },
    [queryClient],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
    localStorage.removeItem(STORAGE_SUCURSAL_ACTIVA_KEY);
    queryClient.clear();
    setUsuario(null);
  }, [queryClient]);

  /**
   * Silenciosa (sin pedir contraseña de nuevo) — reemite accessToken/usuario
   * con permisos/modulosActivos al día. Sin esto, un cambio de Plan/módulos
   * en Plataforma o de permisos de un rol no se reflejaba en el Sidebar
   * hasta el próximo logout+login manual (usuario.modulosActivos/permisos
   * quedaban congelados en la foto del último login) — la aplicación REAL
   * de ambos ya era 100% en vivo del lado del backend (PermissionsGuard/
   * ModuloActivoGuard), esto solo pone al día lo que el frontend MUESTRA.
   * Falla en silencio a propósito: si la red falla, la sesión sigue
   * funcionando con los datos que ya tenía, y el siguiente intento
   * programado lo reintenta — un 401 real ya lo maneja el interceptor
   * global de `apiClient` (logout + redirect a /login).
   */
  const refrescarSesion = useCallback(async () => {
    try {
      const { data } = await apiClient.post('/auth/refrescar');
      localStorage.setItem(STORAGE_KEY, data.accessToken);
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(data.usuario));
      setUsuario(data.usuario);
    } catch {
      // silencioso — ver comentario de arriba.
    }
  }, []);

  // Al montar (o cuando cambia DE usuario, es decir login/logout — nunca
  // por el propio refresco, que reutiliza el mismo id) y cada
  // INTERVALO_REFRESCO_MS mientras la pestaña siga abierta con sesión activa.
  const usuarioId = usuario?.id;
  useEffect(() => {
    if (!usuarioId) return;
    refrescarSesion();
    const id = setInterval(refrescarSesion, INTERVALO_REFRESCO_MS);
    return () => clearInterval(id);
  }, [usuarioId, refrescarSesion]);

  // `?.permisos?.` (no solo `?.permisos.`) a propósito: una sesión que
  // inició antes de que este campo existiera tiene `usuario` guardado en
  // localStorage sin `permisos` — sin el segundo `?.` esto reventaría con
  // un TypeError en vez de tratarlo como "sin permisos" hasta el próximo login.
  const tienePermiso = useCallback((permiso: string) => usuario?.permisos?.includes(permiso) ?? false, [usuario]);
  const tieneModulo = useCallback((modulo: string) => usuario?.modulosActivos?.includes(modulo) ?? false, [usuario]);

  const actualizarTienePin = useCallback((tienePin: boolean) => {
    setUsuario((actual) => {
      if (!actual) return actual;
      const actualizado = { ...actual, tienePin };
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(actualizado));
      return actualizado;
    });
  }, []);

  const value = useMemo(
    () => ({ usuario, cargando, login, logout, tienePermiso, tieneModulo, actualizarTienePin, refrescarSesion }),
    [usuario, cargando, login, logout, tienePermiso, tieneModulo, actualizarTienePin, refrescarSesion],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
