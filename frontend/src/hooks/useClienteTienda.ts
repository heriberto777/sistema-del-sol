import { useCallback, useState } from 'react';
import { tiendaApiClient } from '../lib/tienda-api-client';

export interface ClienteTiendaSesion {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
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
    },
    [subdominio],
  );

  const cerrarSesion = useCallback(() => {
    localStorage.removeItem(claveToken(subdominio));
    localStorage.removeItem(claveCliente(subdominio));
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

  return { token, cliente, autenticado: !!token, registro, login, cerrarSesion };
}

export type ClienteTienda = ReturnType<typeof useClienteTienda>;
