export interface LineaPedidoRecibo {
  nombre: string;
  cantidad: string;
  precioUnitario: string;
  descuento: string;
  montoTotal: string;
}

export interface EntregaPedidoRecibo {
  nombre: string;
  telefono: string;
  direccion: string;
}

export type EstadoFacturaRecibo = 'BORRADOR' | 'EMITIDA' | 'ANULADA';

export interface DatosReciboPedido {
  storeNombre: string;
  storeLogo: string | null;
  colorAcento: string;
  numero: string;
  estado: EstadoFacturaRecibo;
  pagada: boolean;
  subtotal: string;
  itbis: string;
  total: string;
  pendiente: number;
  pasarelaDisponible: 'AZUL' | 'CARDNET' | null;
  lineas: LineaPedidoRecibo[];
  entrega: EntregaPedidoRecibo | null;
}

/**
 * Props compartidas por las 4 plantillas de "pedido realizado" — cada una
 * (ver `RECIBO`/`MARCA`/`BOUTIQUE`/`PANEL` en `index.tsx`) es puramente
 * visual sobre los mismos datos; el pago (monto = `pendiente` completo,
 * sin monto editable — a diferencia del link de cobro genérico, acá es
 * un checkout, no una factura con saldo parcial) y sus estados de carga/
 * error viven en `CobroFactura.tsx`, no en cada plantilla.
 */
export interface PlantillaPedidoProps {
  datos: DatosReciboPedido;
  subdominio: string;
  onPagar: () => void;
  pagando: boolean;
  error: string | null;
}
