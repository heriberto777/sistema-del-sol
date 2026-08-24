import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export interface Puesto {
  id: string;
  nombre: string;
  activo: boolean;
}

/** Catálogo de puestos activos del tenant (plan de integración Cuadre, ítem G-8) — puramente clasificatorio, no reemplaza Empleado.cargo. */
export function usePuestos() {
  return useQuery({
    queryKey: ['puestos-activos'],
    queryFn: async () => (await apiClient.get<Puesto[]>('/nomina/puestos', { params: { activo: true } })).data,
  });
}
