import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export type AplicaTerminoPago = 'CLIENTE' | 'PROVEEDOR' | 'AMBOS';

export interface TerminoPago {
  id: string;
  nombre: string;
  dias: number;
  descuentoProntoPagoPct: string | null;
  diasProntoPago: number | null;
  aplicaA: AplicaTerminoPago;
  activo: boolean;
}

/** Catálogo compartido CxC/CxP de términos de pago activos del tenant — filtrar por `aplicaA` en el componente que lo consume (CLIENTE/PROVEEDOR/AMBOS). */
export function useTerminosPago() {
  return useQuery({
    queryKey: ['terminos-pago-activos'],
    queryFn: async () => (await apiClient.get<TerminoPago[]>('/terminos-pago', { params: { activo: true } })).data,
  });
}
