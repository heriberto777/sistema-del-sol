// Catálogo de eventos del Event Bus. Cada módulo emite los suyos y
// otros módulos se suscriben sin acoplarse directamente entre sí.
export const EVENTOS = {
  FACTURA_CREADA: 'factura.creada',
  FACTURA_ANULADA: 'factura.anulada',
  STOCK_BAJO: 'inventario.stock_bajo',
  ORDEN_COMPRA_RECIBIDA: 'compras.orden_recibida',
  ORDEN_COMPRA_DEVUELTA: 'compras.orden_devuelta',
  CLIENTE_CREADO: 'clientes.cliente_creado',
  NOMINA_PERIODO_PAGADO: 'nomina.periodo_pagado',
  PAGO_FACTURA_REGISTRADO: 'pagos.factura_registrado',
  PAGO_ORDEN_COMPRA_REGISTRADO: 'pagos.orden_compra_registrado',
  COTIZACION_ENVIADA: 'cotizaciones.enviada',
} as const;

export type NombreEvento = (typeof EVENTOS)[keyof typeof EVENTOS];

export interface FacturaCreadaPayload {
  tenantId: string;
  facturaId: string;
  clienteId: string;
  total: string;
  subtotal: string;
  itbis: string;
  tipoFactura: string;
}

export interface OrdenCompraRecibidaPayload {
  tenantId: string;
  ordenCompraId: string;
  recepcionId: string;
  proveedorId: string;
  total: string;
}

export interface OrdenCompraDevueltaPayload {
  tenantId: string;
  ordenCompraId: string;
  devolucionId: string;
  proveedorId: string;
  monto: string;
  itbis: string;
}

/** Totales agregados de todos los recibos del período, ya en string (igual convención que FacturaCreadaPayload) — Number() en el listener. */
export interface NominaPeriodoPagadoPayload {
  tenantId: string;
  periodoId: string;
  totalSalarioBruto: string;
  totalSfsEmpleado: string;
  totalAfpEmpleado: string;
  totalIsr: string;
  totalOtrasDeducciones: string;
  totalSalarioNeto: string;
  totalSfsEmpleador: string;
  totalAfpEmpleador: string;
  totalInfotep: string;
}

export interface StockBajoPayload {
  tenantId: string;
  productoId: string;
  bodegaId: string;
  cantidadActual: string;
  stockMinimo: string;
}

export interface PagoFacturaRegistradoPayload {
  tenantId: string;
  pagoId: string;
  facturaId: string;
  monto: string;
}

export interface PagoOrdenCompraRegistradoPayload {
  tenantId: string;
  pagoId: string;
  ordenCompraId: string;
  monto: string;
}

export interface CotizacionEnviadaPayload {
  tenantId: string;
  cotizacionId: string;
  clienteId: string;
  numero: string;
  total: string;
}
