import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export interface VarianteProducto {
  id: string;
  sku: string | null;
  codigoBarras: string | null;
  activa: boolean;
  valoresAtributo: { valorAtributo: { id: string; valor: string; atributoId: string; atributo: { nombre: string } } }[];
  /** Solo viene si se pidió con `bodegaId` — disponible = cantidadActual - cantidadReservada, puramente informativo (ver CatalogoProductosPos). */
  existencia?: number;
}

/** Variantes reales de un producto (Fase 3c) — vacío mientras no haya productoId, o si el producto nunca tuvo atributos (una sola variante "por defecto", que no exige selección explícita). `bodegaId` opcional agrega `existencia` por variante (ver VariantesService.listarPorProducto). */
export function useVariantesProducto(productoId: string | null | undefined, bodegaId?: string) {
  return useQuery({
    queryKey: ['variantes-producto', productoId, bodegaId],
    queryFn: async () =>
      (await apiClient.get<VarianteProducto[]>(`/productos/${productoId}/variantes`, { params: { bodegaId } })).data,
    enabled: !!productoId,
  });
}

export function etiquetaVariante(variante: VarianteProducto): string {
  return variante.valoresAtributo.map((va) => `${va.valorAtributo.atributo.nombre}: ${va.valorAtributo.valor}`).join(', ');
}
