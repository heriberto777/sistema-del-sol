import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export interface CategoriaCliente {
  id: string;
  nombre: string;
  activa: boolean;
}

/** Catálogo de categorías/segmentación de cliente activas del tenant (plan de integración Cuadre, ítem E-5) — puramente informativo, sin efecto en precios/permisos. */
export function useCategoriasCliente() {
  return useQuery({
    queryKey: ['categorias-cliente-activas'],
    queryFn: async () => (await apiClient.get<CategoriaCliente[]>('/categorias-cliente', { params: { activa: true } })).data,
  });
}
