import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export interface CentroCosto {
  id: string;
  nombre: string;
  activo: boolean;
}

/** Catálogo de Centros de Costo activos del tenant (docs/PLAN.md, punto 3) — para selects en Gasto Menor, Factura de Proveedor, Facturación, Compras y Asiento manual. */
export function useCentrosCosto() {
  return useQuery({
    queryKey: ['centros-costo-activos'],
    queryFn: async () => (await apiClient.get<CentroCosto[]>('/centros-costo', { params: { activo: true } })).data,
  });
}
