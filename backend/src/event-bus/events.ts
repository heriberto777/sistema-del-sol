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
  GASTO_MENOR_CREADO: 'gastos_menores.creado',
  LOTE_POR_VENCER: 'inventario.lote_por_vencer',
  NCF_POR_AGOTARSE: 'ncf.por_agotarse',
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
  // Ítem A-1 (Comisiones de venta) — solo lo llenan ventas de POS que
  // eligen un vendedor (ítem F-2). null si no hay uno.
  vendedorEmpleadoId?: string | null;
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
  totalDescuentoAusencias: string;
  /** Opcional: períodos generados antes de esta feature no lo emiten. */
  totalHorasExtra?: string;
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
  retencionIsr: string;
  retencionItbis: string;
}

export interface CotizacionEnviadaPayload {
  tenantId: string;
  cotizacionId: string;
  clienteId: string;
  numero: string;
  total: string;
}

/** El listener re-consulta el GastoMenor completo (líneas, cuenta bancaria) — mismo patrón que OrdenCompraRecibidaPayload. */
export interface GastoMenorCreadoPayload {
  tenantId: string;
  gastoMenorId: string;
}

/** Emitido por LotesCronService (Fase 5b) — uno por lote con saldo próximo a vencer, mismo criterio que StockBajoPayload. */
export interface LotePorVencerPayload {
  tenantId: string;
  loteId: string;
  productoNombre: string;
  numeroLote: string;
  fechaVencimiento: string;
  cantidadActual: string;
}

/** Emitido por FacturacionRepository.siguienteNcfEnTx (plan de integración Cuadre, ítem B-2) cuando los comprobantes restantes caen a `umbralAlerta` o menos. */
export interface NcfPorAgotarsePayload {
  tenantId: string;
  tipoNcf: string;
  sucursalId: string | null;
  restantes: number;
  umbralAlerta: number;
}
