import { useCallback, useEffect, useState } from 'react';
import { tiendaApiClient } from '../lib/tienda-api-client';

export interface ClienteTiendaSesion {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  puntosLealtad: number;
}

function claveToken(subdominio: string): string {
  return `sol_cliente_tienda_token_${subdominio}`;
}

function claveCliente(subdominio: string): string {
  return `sol_cliente_tienda_perfil_${subdominio}`;
}

function leer<T>(clave: string): T | null {
  try {
    const raw = localStorage.getItem(clave);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/**
 * Sin Context (a diferencia de `CarritoTiendaContext`) — cada Nav de las
 * 17 plantillas + `CarritoTiendaProvider` llaman `useClienteTienda(subdominio)`
 * por su cuenta, cada uno con su propio `useState` leído de localStorage
 * SOLO al montar. Sin este pub/sub en memoria, un login/logout hecho
 * desde UNA instancia (ej. el formulario de Login) nunca se refleja en
 * las demás instancias ya montadas (ej. `CarritoTiendaProvider`, que
 * necesita enterarse para sincronizar el carrito — bug real encontrado
 * en la verificación en vivo de la Fase 16: el carrito nunca subía al
 * servidor tras loguearse porque el `token` de esa instancia seguía en
 * `null`). Notificar por subdominio (no global) porque cada tienda es
 * independiente.
 */
const listenersPorSubdominio = new Map<string, Set<() => void>>();

function notificarCambioSesion(subdominio: string) {
  listenersPorSubdominio.get(subdominio)?.forEach((fn) => fn());
}

function suscribirCambioSesion(subdominio: string, fn: () => void): () => void {
  if (!listenersPorSubdominio.has(subdominio)) listenersPorSubdominio.set(subdominio, new Set());
  listenersPorSubdominio.get(subdominio)!.add(fn);
  return () => listenersPorSubdominio.get(subdominio)?.delete(fn);
}

/**
 * Sesión del comprador del storefront (Fase 6) — token/perfil en
 * localStorage por subdominio (mismo criterio de scoping que
 * `useCarritoTienda`). Sin interceptor de 401/redirect: `tiendaApiClient`
 * no reacciona a nada, un token vencido en "Mis pedidos" simplemente
 * responde 401 y esa página lo maneja mostrando "iniciá sesión de
 * nuevo" — un comprador anónimo del resto de la tienda nunca se ve
 * afectado por esto.
 */
export function useClienteTienda(subdominio: string) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(claveToken(subdominio)));
  const [cliente, setCliente] = useState<ClienteTiendaSesion | null>(() => leer(claveCliente(subdominio)));

  useEffect(
    () =>
      suscribirCambioSesion(subdominio, () => {
        setToken(localStorage.getItem(claveToken(subdominio)));
        setCliente(leer(claveCliente(subdominio)));
      }),
    [subdominio],
  );

  const guardarSesion = useCallback(
    (accessToken: string, perfil: ClienteTiendaSesion) => {
      try {
        localStorage.setItem(claveToken(subdominio), accessToken);
        localStorage.setItem(claveCliente(subdominio), JSON.stringify(perfil));
      } catch {
        // localStorage lleno/deshabilitado — la sesión sigue funcionando en memoria para esta pestaña.
      }
      setToken(accessToken);
      setCliente(perfil);
      notificarCambioSesion(subdominio);
    },
    [subdominio],
  );

  const cerrarSesion = useCallback(() => {
    localStorage.removeItem(claveToken(subdominio));
    localStorage.removeItem(claveCliente(subdominio));
    notificarCambioSesion(subdominio);
    setToken(null);
    setCliente(null);
  }, [subdominio]);

  const registro = useCallback(
    async (dto: { nombre: string; email: string; password: string; telefono?: string }) => {
      const { data } = await tiendaApiClient.post<{ accessToken: string; cliente: ClienteTiendaSesion }>(
        `/tienda/${subdominio}/auth/registro`,
        dto,
      );
      guardarSesion(data.accessToken, data.cliente);
    },
    [subdominio, guardarSesion],
  );

  const login = useCallback(
    async (dto: { email: string; password: string }) => {
      const { data } = await tiendaApiClient.post<{ accessToken: string; cliente: ClienteTiendaSesion }>(
        `/tienda/${subdominio}/auth/login`,
        dto,
      );
      guardarSesion(data.accessToken, data.cliente);
    },
    [subdominio, guardarSesion],
  );

  /** Actualiza el perfil cacheado en localStorage tras un `PATCH /mi-perfil` exitoso, sin pedir un nuevo login — Nav/checkout de todas las plantillas leen `cliente.nombre` de acá. */
  const actualizarPerfilLocal = useCallback(
    (perfil: Partial<ClienteTiendaSesion>) => {
      setCliente((actual) => {
        if (!actual) return actual;
        const siguiente = { ...actual, ...perfil };
        try {
          localStorage.setItem(claveCliente(subdominio), JSON.stringify(siguiente));
        } catch {
          // localStorage lleno/deshabilitado — el cambio sigue reflejado en memoria para esta pestaña.
        }
        return siguiente;
      });
      notificarCambioSesion(subdominio);
    },
    [subdominio],
  );

  return { token, cliente, autenticado: !!token, registro, login, cerrarSesion, actualizarPerfilLocal };
}

export type ClienteTienda = ReturnType<typeof useClienteTienda>;
