import { useQuery } from '@tanstack/react-query';
import { tiendaApiClient } from '../lib/tienda-api-client';
import { PaginaResultado } from '../types/pagina-resultado';
import { TemaTienda } from '../pages/tienda/tema';
import { MensajeBannerAnuncio } from '../pages/tienda/BannerAnuncio';

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
  | 'OFICIO'
  | 'BAZAR'
  | 'VITRINA'
  | 'SOLMARKET';

export interface ConfigTienda {
  nombre: string;
  plantilla: PlantillaTienda;
  logo: string | null;
  banner: string | null;
  colorAcento: string | null;
  /** Fase 7 — personalización sobre la plantilla elegida (siempre resuelto con defaults, nunca null). */
  tema: TemaTienda;
  /** Fase 11 (extendida) — slide de mensajes para la barra de anuncio arriba del Nav; `mensajes: []` = no mostrar nada. */
  bannerAnuncio: { mensajes: MensajeBannerAnuncio[]; intervaloSegundos: number };
}

/** Fase 13 — oferta a mostrar en la tarjeta de producto (mirror de `OfertaVisibleProducto`, backend). `null` = sin oferta vigente para este producto/precio. */
export type OfertaVisibleProducto =
  | { tipo: 'DESCUENTO'; precioConDescuento: number; ahorro: number; porcentaje: number }
  | { tipo: 'BOGO'; comprarCantidad: number; llevarCantidad: number; porcentajeDescuentoLlevar: number };

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
  /** Fase 13 — `null` si no hay ninguna oferta vigente para este producto/categoría. */
  oferta: OfertaVisibleProducto | null;
}

export interface VarianteTienda {
  id: string;
  /** Ej. "Talla: M, Color: Rojo" — vacío si el producto nunca usó atributos. */
  etiqueta: string;
  precio: string | null;
  stock: number | null;
  /** Fase 13 — oferta vigente para ESTA variante (cada una puede tener un precio distinto). */
  oferta: OfertaVisibleProducto | null;
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
  fechaFin: string;
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

/** Etiqueta de vigencia para la sección "Ofertas" (Fase 12) — a partir de `fechaFin` (real, del modelo Oferta), sin simular ningún "% reclamado" que no existe como dato. */
export function etiquetaVigenciaOferta(fechaFinIso: string): string {
  const finDia = new Date(fechaFinIso);
  finDia.setHours(0, 0, 0, 0);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const diasRestantes = Math.round((finDia.getTime() - hoy.getTime()) / 86400000);
  if (diasRestantes <= 0) return 'Termina hoy';
  if (diasRestantes === 1) return 'Termina mañana';
  if (diasRestantes <= 7) return `Termina en ${diasRestantes} días`;
  return `Vence el ${new Date(fechaFinIso).toLocaleDateString('es-DO', { day: '2-digit', month: 'short' })}`;
}

export interface CategoriaTienda {
  id: string;
  nombre: string;
  cantidad: number;
}

/** Chips de categoría del Home (Fase 12, plantillas "marketplace") — solo categorías con al menos un producto visible. */
export function useCategoriasTienda(subdominio: string) {
  return useQuery({
    queryKey: ['tienda-categorias', subdominio],
    queryFn: async () => (await tiendaApiClient.get<CategoriaTienda[]>(`/tienda/${subdominio}/categorias`)).data,
  });
}

export type TipoSeccionTienda = 'PRODUCTOS' | 'CATEGORIA' | 'BANNER' | 'MINIGRID';

/**
 * Bloque del Home armado por el admin (Fase 17, "Secciones Dinámicas") —
 * qué campos vienen resueltos depende de `tipo`: PRODUCTOS/BANNER traen
 * `productos` (BANNER se renderiza como slideshow, misma data);
 * CATEGORIA trae `categoria` (mismo shape que `CategoriaTienda`, sin
 * `cantidad`); MINIGRID trae `categorias` (2 a 4).
 */
export interface SeccionTienda {
  id: string;
  tipo: TipoSeccionTienda;
  titulo: string;
  subtitulo: string | null;
  ctaTexto: string | null;
  imagen: string | null;
  color: string | null;
  categoria: { id: string; nombre: string } | null;
  categorias: { id: string; nombre: string }[];
  productos: ProductoTienda[];
}

/** Secciones activas del Home, ya en el orden que definió el admin. `[]` si el admin no armó ninguna — el Home sigue funcionando solo con Destacados/Ofertas builtin. */
export function useSeccionesTienda(subdominio: string) {
  return useQuery({
    queryKey: ['tienda-secciones', subdominio],
    queryFn: async () => (await tiendaApiClient.get<SeccionTienda[]>(`/tienda/${subdominio}/secciones`)).data,
  });
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

/** Texto corto para la insignia de la tarjeta (Fase 13) — ej. "-20%", "2×1", "3ra al 50%". */
export function badgeCortoOferta(oferta: OfertaVisibleProducto): string {
  if (oferta.tipo === 'DESCUENTO') return `-${oferta.porcentaje}%`;
  const { comprarCantidad, llevarCantidad, porcentajeDescuentoLlevar } = oferta;
  if (porcentajeDescuentoLlevar >= 100) return `${comprarCantidad + llevarCantidad}×${comprarCantidad}`;
  return `${porcentajeDescuentoLlevar}% en la ${llevarCantidad}ª`;
}

/** Línea debajo del precio (Fase 13) — `detallada` suma el porcentaje/mecánica completa (estilo "Ahorro"). */
export function lineaOferta(oferta: OfertaVisibleProducto, detallada: boolean): string {
  if (oferta.tipo === 'BOGO') {
    const { comprarCantidad, llevarCantidad, porcentajeDescuentoLlevar } = oferta;
    const etiquetaDescuento = porcentajeDescuentoLlevar >= 100 ? 'gratis' : `al ${porcentajeDescuentoLlevar}% OFF`;
    return detallada
      ? `Comprá ${comprarCantidad}, llevá ${llevarCantidad} ${etiquetaDescuento}`
      : `Llevá ${comprarCantidad + llevarCantidad}, ${llevarCantidad} ${etiquetaDescuento}`;
  }
  return detallada ? `Ahorrás ${formatearPrecio(oferta.ahorro)} (${oferta.porcentaje}%)` : `Ahorrás ${formatearPrecio(oferta.ahorro)}`;
}
