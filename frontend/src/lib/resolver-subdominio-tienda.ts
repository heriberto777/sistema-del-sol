import { createContext } from 'react';
import { apiClient } from './api-client';

// Mismo dominio hardcodeado en toda la infra de este SaaS (CI, deploy,
// docs) — no hace falta que sea configurable en runtime.
const DOMINIO_BASE = 'ciguadev.com';

// Mismo criterio que `backend/src/tenants/subdominios-reservados.ts`
// (SUBDOMINIOS_RESERVADOS): acá solo importan los que de verdad resuelven
// a esta app por DNS — `app.ciguadev.com` es el panel de admin fijo de
// TODOS los tenants, `www.ciguadev.com` cae al mismo lugar.
const HOSTS_ADMIN = new Set(['app', 'www']);

/**
 * Resolución síncrona y local (sin red) para los 2 casos ya conocidos:
 * desarrollo (`localhost`/`127.0.0.1`, siempre admin) y un subdominio de
 * nuestra propia plataforma (`<subdominio>.ciguadev.com`). `undefined` =
 * el hostname no calza con ninguno de los dos — puede ser un dominio
 * propio de tenant (ver `TenantDominio`, backend) y hace falta
 * preguntarle a la API antes de decidir qué árbol de rutas montar (ver
 * `resolverSubdominioPorDominioPropio`).
 */
export function resolverContextoTiendaSincrono(): string | null | undefined {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return null;

  const esDominioDePlataforma = hostname === DOMINIO_BASE || hostname.endsWith(`.${DOMINIO_BASE}`);
  if (!esDominioDePlataforma) return undefined;

  const labels = hostname.split('.');
  // El propio ciguadev.com sin ningún subdominio -> admin.
  if (labels.length < 3) return null;
  const primerLabel = labels[0].toLowerCase();
  return HOSTS_ADMIN.has(primerLabel) ? null : primerLabel;
}

/**
 * Solo se llama cuando `resolverContextoTiendaSincrono()` devolvió
 * `undefined` (hostname fuera de `*.ciguadev.com`) — ver
 * `GET /api/tenants/resolver-por-dominio` (`TenantDominiosPublicaController`,
 * backend). Un 404 (dominio no asignado a ningún tenant activo) cae a
 * `null` — mismo fallback que ya aplicaba a cualquier hostname no
 * reconocido antes de que existiera el dominio propio (app de admin).
 */
export async function resolverSubdominioPorDominioPropio(): Promise<string | null> {
  try {
    const { data } = await apiClient.get<{ subdominio: string }>('/tenants/resolver-por-dominio', {
      params: { host: window.location.hostname },
    });
    return data.subdominio;
  } catch {
    return null;
  }
}

/**
 * Subdominio ya resuelto por `App.tsx` antes de montar el router —
 * consumido por `useSubdominioTienda()` para el caso de dominio propio,
 * donde no hay forma de derivarlo recortando el hostname (a diferencia de
 * `<subdominio>.ciguadev.com`, acá el hostname completo no tiene ninguna
 * relación textual con el subdominio real del tenant).
 */
export const SubdominioTiendaContext = createContext<string | null>(null);
