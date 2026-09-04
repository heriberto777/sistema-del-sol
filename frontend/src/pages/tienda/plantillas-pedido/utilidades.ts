import { DatosReciboPedido, LineaPedidoRecibo } from './tipos';

export function cantidadLinea(linea: LineaPedidoRecibo): number {
  return Number(linea.cantidad);
}

export function tieneDescuento(linea: LineaPedidoRecibo): boolean {
  return Number(linea.descuento) > 0;
}

/** Precio de lista de la línea ANTES del descuento — solo para mostrar tachado, nunca para calcular nada. */
export function precioListaLinea(linea: LineaPedidoRecibo): number {
  return cantidadLinea(linea) * Number(linea.precioUnitario);
}

export function porcentajeDescuentoLinea(linea: LineaPedidoRecibo): number {
  const lista = precioListaLinea(linea);
  return lista > 0 ? Math.round((Number(linea.descuento) / lista) * 100) : 0;
}

export function estadoMostrado(datos: DatosReciboPedido): 'PAGADA' | 'ANULADA' | 'EMITIDA' | 'BORRADOR' {
  if (datos.pagada) return 'PAGADA';
  return datos.estado;
}

export function puedeIniciarPago(datos: DatosReciboPedido): boolean {
  return !datos.pagada && datos.estado === 'EMITIDA' && !!datos.pasarelaDisponible;
}
