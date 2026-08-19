import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export interface ListaPrecio {
  id: string;
  nombre: string;
  activa: boolean;
}

/** Catálogo de niveles de precio activos del tenant (Fase 3b de adopción de Cuadre) — usado tanto para el selector por id (Cliente.listaPrecioId) como para el override por nombre al facturar/cotizar/vender en POS. */
export function useListasPrecio() {
  return useQuery({
    queryKey: ['listas-precio-activas'],
    queryFn: async () => (await apiClient.get<ListaPrecio[]>('/listas-precio', { params: { activa: true } })).data,
  });
}
