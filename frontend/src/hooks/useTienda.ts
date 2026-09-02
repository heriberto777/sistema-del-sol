import { useQuery } from '@tanstack/react-query';
import { tiendaApiClient } from '../lib/tienda-api-client';
import { PaginaResultado } from '../types/pagina-resultado';

export type PlantillaTienda = 'DIRECTO' | 'MERCADO' | 'BOUTIQUE';

export interface ConfigTienda {
  nombre: string;
  plantilla: PlantillaTienda;
  logo: string | null;
  banner: string | null;
  colorAcento: string | null;
}

export interface ProductoTienda {
  id: string;
  codigo: string;
  nombre: string;
  imagen: string | null;
  imagenAjuste: string;
  porcentajeItbis: string;
  tipo: string;
  categoria: { id: string; nombre: string } | null;
  precio: string | null;
  stock: number | null;
  /** Solo útil para agregar directo cuando `tieneVariantes` es false — con más de una variante, ver el detalle antes de decidir cuál. */
  varianteId: string | null;
  /** Fase 4 — si tiene más de una variante (ej. Talla/Color), la grilla no puede agregar directo, hay que elegir en el detalle. */
  tieneVariantes: boolean;
}

export interface VarianteTienda {
  id: string;
  /** Ej. "Talla: M, Color: Rojo" — vacío si el producto nunca usó atributos (una sola variante "por defecto"). */
  etiqueta: string;
  precio: string | null;
  stock: number | null;
}

export interface ProductoTiendaDetalle {
  id: string;
  codigo: string;
  nombre: string;
  imagen: string | null;
  imagenAjuste: string;
  porcentajeItbis: string;
  tipo: string;
  categoria: { id: string; nombre: string } | null;
  /** Siempre al menos 1 (todo producto real tiene una variante, aunque nunca haya usado atributos). */
  variantes: VarianteTienda[];
}

/** `retry: false` — un 404 acá es real (tienda inexistente/inactiva), no un hipo de red que valga reintentar. */
export function useTiendaConfig(subdominio: string) {
  return useQuery({
    queryKey: ['tienda-config', subdominio],
    queryFn: async () => (await tiendaApiClient.get<ConfigTienda>(`/tienda/${subdominio}/config`)).data,
    retry: false,
  });
}

export function useTiendaCatalogo(subdominio: string, params: { pagina?: number; busqueda?: string; categoriaId?: string }) {
  return useQuery({
    queryKey: ['tienda-catalogo', subdominio, params],
    queryFn: async () => (await tiendaApiClient.get<PaginaResultado<ProductoTienda>>(`/tienda/${subdominio}/productos`, { params })).data,
  });
}

export function useTiendaProducto(subdominio: string, productoId: string) {
  return useQuery({
    queryKey: ['tienda-producto', subdominio, productoId],
    queryFn: async () => (await tiendaApiClient.get<ProductoTiendaDetalle>(`/tienda/${subdominio}/productos/${productoId}`)).data,
    retry: false,
  });
}

export function formatearPrecio(precio: string | number | null): string {
  return `RD$ ${Number(precio ?? 0).toLocaleString('es-DO')}`;
}
