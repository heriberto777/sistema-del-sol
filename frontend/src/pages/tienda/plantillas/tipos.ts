import { ConfigTienda, ProductoTienda, ProductoTiendaDetalle, VarianteTienda } from '../../../hooks/useTienda';
import { CarritoTienda } from '../../../hooks/useCarritoTienda';

export interface PropsBase {
  config: ConfigTienda;
  subdominio: string;
  carrito: CarritoTienda;
}

export interface PropsHome extends PropsBase {
  productos: ProductoTienda[];
  cargando: boolean;
  busqueda: string;
  onBuscar: (valor: string) => void;
}

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
