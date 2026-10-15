import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

/**
 * Negocio que no es contribuyente de la DGII (o no quiere emitir
 * comprobante fiscal) — ver NcfPanel. Default `true` mientras carga, para
 * que el selector de Comprobante fiscal no "parpadee" visible y luego
 * desaparezca en el caso normal (inmensa mayoría de los tenants).
 */
export function useRequiereComprobanteFiscal() {
  const { data } = useQuery({
    queryKey: ['admin-ncf-requiere-comprobante'],
    queryFn: async () => (await apiClient.get<boolean>('/admin/ncf/requiere-comprobante')).data,
  });
  return data ?? true;
}
