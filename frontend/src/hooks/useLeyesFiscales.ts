import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export interface LeyFiscal {
  id: string;
  codigo: string;
  nombre: string;
  porcentajeItbisAPagar: string;
  activa: boolean;
}

/** Catálogo de leyes fiscales activas del tenant (plan de integración Cuadre, ítem B-3) — reduce el ITBIS efectivo de un Producto. */
export function useLeyesFiscales() {
  return useQuery({
    queryKey: ['leyes-fiscales-activas'],
    queryFn: async () => (await apiClient.get<LeyFiscal[]>('/leyes-fiscales', { params: { activa: true } })).data,
  });
}
