import { useQuery } from '@tanstack/react-query';
import { tiendaApiClient } from '../lib/tienda-api-client';
import { PaginaResultado } from '../types/pagina-resultado';
import { TemaTienda } from '../pages/tienda/tema';

export type PlantillaTienda =
  | 'DIRECTO'
  | 'MERCADO'
  | 'BOUTIQUE'
  | 'BRUMA'
  | 'BLOQUE'
  | 'NODO'
  | 'CHISPA'
  | 'EDITORIAL'
  | 'BASE'
  | 'ROPERO'
  | 'AMPLIA'
  | 'DISTRITO'
  | 'ATELIER'
  | 'OFICIO';

export interface ConfigTienda {
  nombre: string;
  plantilla: PlantillaTienda;
  logo: string | null;
  banner: string | null;
  colorAcento: string | null;
  /** Fase 7 — personalización sobre la plantilla elegida (siempre resuelto con defaults, nunca null). */
  tema: TemaTienda;
  /** Fase 11 — mensaje de texto libre para la barra de anuncio arriba del Nav; `null`/vacío = no mostrar nada. */
  bannerTexto: string | null;
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
  descripcionTienda: string | null;
  /** Fotos adicionales a la portada (`imagen`) — Fase 5. */
  imagenesAdicionales: string[];
  /** Siempre al menos 1 (todo producto real tiene una variante, aunque nunca haya usado atributos). */
  variantes: VarianteTienda[];
  /** "También te puede interesar" (Fase 11) — misma categoría, hasta 4, `[]` si el producto no tiene categoría. */
  relacionados: ProductoTienda[];
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

/** Sección "Destacados" del Home (Fase 11) — mismo catálogo público, filtrado por `destacado=true`, tamaño de página fijo. */
export function useProductosDestacados(subdominio: string, limite = 8) {
  return useQuery({
    queryKey: ['tienda-destacados', subdominio],
    queryFn: async () =>
      (
        await tiendaApiClient.get<PaginaResultado<ProductoTienda>>(`/tienda/${subdominio}/productos`, {
          params: { destacado: 'true', tamanoPagina: limite },
        })
      ).data.datos,
  });
}

export interface OfertaTienda {
  id: string;
  nombre: string;
  tipoDescuento: 'PORCENTAJE' | 'MONTO_FIJO' | 'BOGO';
  valor: string | null;
  alcance: 'PRODUCTO' | 'CATEGORIA' | 'CARRITO';
  comprarCantidad: number | null;
  llevarCantidad: number | null;
  porcentajeDescuentoLlevar: string | null;
  producto: { nombre: string } | null;
  categoria: { nombre: string } | null;
}

/** Sección "Ofertas" del Home (Fase 11) — ofertas reales del motor ya usado en POS/Facturación, vigentes ahora mismo. */
export function useOfertasTienda(subdominio: string) {
  return useQuery({
    queryKey: ['tienda-ofertas', subdominio],
    queryFn: async () => (await tiendaApiClient.get<OfertaTienda[]>(`/tienda/${subdominio}/ofertas`)).data,
  });
}

/** Texto corto para la tarjeta de una oferta (ej. "20% OFF en Camisas", "RD$100 OFF", "2×1 en tu compra") — no resuelve precio con descuento por producto, solo el resumen informativo. */
export function resumenOferta(oferta: OfertaTienda): string {
  const destino = oferta.alcance === 'PRODUCTO' ? `en ${oferta.producto?.nombre ?? 'un producto'}` : oferta.alcance === 'CATEGORIA' ? `en ${oferta.categoria?.nombre ?? 'una categoría'}` : 'en tu compra';
  if (oferta.tipoDescuento === 'BOGO') {
    const pct = Number(oferta.porcentajeDescuentoLlevar ?? 100);
    const etiquetaDescuento = pct >= 100 ? 'gratis' : `${pct}% OFF`;
    return `Comprá ${oferta.comprarCantidad ?? 1}, llevá ${oferta.llevarCantidad ?? 1} ${etiquetaDescuento} ${destino}`;
  }
  if (oferta.tipoDescuento === 'PORCENTAJE') {
    return `${Number(oferta.valor ?? 0)}% OFF ${destino}`;
  }
  return `${formatearPrecio(oferta.valor)} OFF ${destino}`;
}

export interface PedidoConFactura {
  factura: { id: string; numero: string | null; ncf: string | null; total: string; estado: string; pagada: boolean; fecha: string };
  pedido: { direccionEntrega: string; notas: string | null; createdAt: string } | null;
}

/** Requiere sesión de cliente (Fase 6) — `enabled: !!token` evita pedirlo antes de tener uno. `retry: false`: un 401 acá es real (token vencido/inválido), no un hipo de red. */
export function useMisPedidos(subdominio: string, token: string | null) {
  return useQuery({
    queryKey: ['tienda-mis-pedidos', subdominio, token],
    queryFn: async () =>
      (
        await tiendaApiClient.get<PedidoConFactura[]>(`/tienda/${subdominio}/mis-pedidos`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ).data,
    enabled: !!token,
    retry: false,
  });
}

export interface PerfilClienteTienda {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  puntosLealtad: number;
}

/** Requiere sesión — mismo criterio que `useMisPedidos` (`enabled`/`retry: false`). */
export function useMiPerfil(subdominio: string, token: string | null) {
  return useQuery({
    queryKey: ['tienda-mi-perfil', subdominio, token],
    queryFn: async () =>
      (await tiendaApiClient.get<PerfilClienteTienda>(`/tienda/${subdominio}/mi-perfil`, { headers: { Authorization: `Bearer ${token}` } })).data,
    enabled: !!token,
    retry: false,
  });
}

export interface DireccionCliente {
  id: string;
  direccion: string;
  ciudad: string | null;
  esPrincipal: boolean;
}

export function useMisDirecciones(subdominio: string, token: string | null) {
  return useQuery({
    queryKey: ['tienda-mis-direcciones', subdominio, token],
    queryFn: async () =>
      (await tiendaApiClient.get<DireccionCliente[]>(`/tienda/${subdominio}/mis-direcciones`, { headers: { Authorization: `Bearer ${token}` } }))
        .data,
    enabled: !!token,
    retry: false,
  });
}

export interface LineaDetallePedido {
  nombre: string;
  cantidad: string;
  precioUnitario: string;
  montoTotal: string;
}

export interface DetallePedido {
  factura: PedidoConFactura['factura'];
  pedido: PedidoConFactura['pedido'];
  lineas: LineaDetallePedido[];
}

/** Se pide "a demanda" — `enabled` solo cuando el comprador expande una card de pedido en Mi Cuenta. */
export function useDetallePedido(subdominio: string, token: string | null, facturaId: string | null) {
  return useQuery({
    queryKey: ['tienda-detalle-pedido', subdominio, facturaId],
    queryFn: async () =>
      (
        await tiendaApiClient.get<DetallePedido>(`/tienda/${subdominio}/mis-pedidos/${facturaId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ).data,
    enabled: !!token && !!facturaId,
    retry: false,
  });
}

export function formatearPrecio(precio: string | number | null): string {
  return `RD$ ${Number(precio ?? 0).toLocaleString('es-DO')}`;
}
