import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export interface VarianteProducto {
  id: string;
  sku: string | null;
  codigoBarras: string | null;
  activa: boolean;
  valoresAtributo: { valorAtributo: { id: string; valor: string; atributoId: string; atributo: { nombre: string } } }[];
}

/** Variantes reales de un producto (Fase 3c) — vacío mientras no haya productoId, o si el producto nunca tuvo atributos (una sola variante "por defecto", que no exige selección explícita). */
export function useVariantesProducto(productoId: string | null | undefined) {
  return useQuery({
    queryKey: ['variantes-producto', productoId],
    queryFn: async () => (await apiClient.get<VarianteProducto[]>(`/productos/${productoId}/variantes`)).data,
    enabled: !!productoId,
  });
}

export function etiquetaVariante(variante: VarianteProducto): string {
  return variante.valoresAtributo.map((va) => `${va.valorAtributo.atributo.nombre}: ${va.valorAtributo.valor}`).join(', ');
}
