import { ConfigTienda, ProductoTiendaDetalle, VarianteTienda } from '../../../hooks/useTienda';
import { CarritoTienda } from '../../../hooks/useCarritoTienda';

export interface PropsBase {
  config: ConfigTienda;
  subdominio: string;
  carrito: CarritoTienda;
}

/**
 * El Home ya NO recibe el catálogo — pedido explícito ("opción B"): el
 * Home es una vidriera curada (banner/Destacados/Ofertas/Secciones), el
 * catálogo completo y cada categoría viven en su propia página
 * (`TiendaProductos`/`TiendaCategoria`, con búsqueda y paginación real).
 * Antes tenía `productos`/`busqueda`/`categorias`/etc. — cualquier
 * buscador que una plantilla muestre en el Home ahora navega a
 * `/tienda/:subdominio/productos?busqueda=...` en vez de filtrar in-place.
 */
export type PropsHome = PropsBase;

export interface PropsProducto extends PropsBase {
  producto: ProductoTiendaDetalle;
  /** null mientras el producto tenga más de una variante y todavía no se eligió ninguna. */
  varianteSeleccionada: VarianteTienda | null;
  onSeleccionarVariante: (varianteId: string) => void;
  cantidad: number;
  onCantidadChange: (cantidad: number) => void;
  onAgregar: () => void;
}

export type PropsCarrito = PropsBase;

export interface Plantilla {
  Home: (props: PropsHome) => JSX.Element;
  Producto: (props: PropsProducto) => JSX.Element;
  Carrito: (props: PropsCarrito) => JSX.Element;
}
