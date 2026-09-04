import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useAuth } from './useAuth';

interface ConfiguracionFila {
  clave: string;
  valor: string;
}

/**
 * Arma la URL pública de la tienda de un tenant. En producción, si esta
 * misma app corre en `app.dominio.com` (o `www.dominio.com`), la tienda
 * vive en `<subdominio>.dominio.com` — se reemplaza el primer label del
 * hostname actual por el subdominio del tenant, se conserva el resto
 * (dominio base + puerto) tal cual. En desarrollo (`localhost`) o si el
 * hostname no sigue ese esquema, cae al patrón viejo (`/tienda/:subdominio`)
 * — mismo criterio que `resolverContextoTiendaSincrono` en
 * `lib/resolver-subdominio-tienda.ts`. No contempla un dominio propio de
 * tenant acá (ver TenantDominio) — este link sigue siempre apuntando al
 * subdominio de ciguadev.com, que nunca deja de funcionar.
 */
export function construirUrlTienda(subdominio: string): string {
  const { protocol, hostname, port } = window.location;
  const labels = hostname.split('.');
  const primerLabel = labels[0]?.toLowerCase();
  if (labels.length >= 3 && (primerLabel === 'app' || primerLabel === 'www')) {
    const dominioBase = labels.slice(1).join('.');
    const puerto = port ? `:${port}` : '';
    return `${protocol}//${subdominio}.${dominioBase}${puerto}`;
  }
  return `${window.location.origin}/tienda/${subdominio}`;
}

/**
 * URL pública de la tienda del tenant, o `null` si el usuario no puede
 * verla (sin `admin.configuracion`, sin módulo `ecommerce`, o la tienda
 * todavía no está activada) — mismo cálculo que ya hace
 * `TiendaOnlineConfigPanel` (que usa `construirUrlTienda` directo, sin
 * este gate, porque ahí se muestra la URL en preview incluso antes de
 * activar), centralizado acá para reusarlo en Sidebar y Dashboard sin
 * duplicar la query.
 */
export function useUrlTiendaPublica(): string | null {
  const { usuario, tienePermiso, tieneModulo } = useAuth();
  const habilitado = tienePermiso('admin.configuracion') && tieneModulo('ecommerce');

  const { data: configuraciones } = useQuery({
    queryKey: ['admin-configuraciones'],
    queryFn: async () => (await apiClient.get<ConfiguracionFila[]>('/admin/configuraciones')).data,
    enabled: habilitado,
  });

  if (!habilitado) return null;
  const activa = configuraciones?.find((c) => c.clave === 'TIENDA_ACTIVA')?.valor === 'true';
  const subdominio = usuario?.tenant?.subdominio;
  if (!activa || !subdominio) return null;
  return construirUrlTienda(subdominio);
}
