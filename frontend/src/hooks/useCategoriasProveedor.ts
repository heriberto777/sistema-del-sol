import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export interface CategoriaProveedor {
  id: string;
  nombre: string;
  activa: boolean;
}

/** Catálogo de categorías/segmentación de proveedor activas del tenant — paridad con useCategoriasCliente (auditoría de organización, "100% ERP"). Puramente informativo, sin efecto en precios/permisos. */
export function useCategoriasProveedor() {
  return useQuery({
    queryKey: ['categorias-proveedor-activas'],
    queryFn: async () => (await apiClient.get<CategoriaProveedor[]>('/categorias-proveedor', { params: { activa: true } })).data,
  });
}
