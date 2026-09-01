import { ConfigTienda, ProductoTienda, ProductoTiendaDetalle } from '../../../hooks/useTienda';
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
