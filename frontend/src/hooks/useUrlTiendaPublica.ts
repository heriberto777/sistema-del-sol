import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useAuth } from './useAuth';

interface ConfiguracionFila {
  clave: string;
  valor: string;
}

/**
 * URL pública de la tienda del tenant (`/tienda/:subdominio`), o `null` si el
 * usuario no puede verla (sin `admin.configuracion`, sin módulo `ecommerce`,
 * o la tienda todavía no está activada) — mismo cálculo que ya hace
 * `TiendaOnlineConfigPanel`, centralizado acá para reusarlo en Sidebar y
 * Dashboard sin duplicar la query.
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
  return `${window.location.origin}/tienda/${subdominio}`;
}
