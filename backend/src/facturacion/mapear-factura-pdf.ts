import { Prisma, TipoFactura } from '@prisma/client';
import { DocumentoPdfParams } from '../common/pdf/documento-pdf';

export const NOMBRE_TIPO_FACTURA: Record<TipoFactura, string> = {
  CONTADO: 'Factura de venta',
  CREDITO: 'Factura de venta',
  NOTA_CREDITO: 'Nota de crédito',
  NOTA_DEBITO: 'Nota de débito',
};

/**
 * Forma mínima que necesita `mapearFacturaAParams` — deliberadamente MÁS
 * chica que `Awaited<ReturnType<FacturacionRepository['buscarPorId']>>`
 * (que trae de más: `notasRelacionadas`/`turnoCaja`, solo para anular()).
 * El resultado de `buscarPorId()` la satisface igual (superset
 * estructural). Vive en su propio archivo (no dentro de
 * `facturacion.service.ts`) para que `notificaciones.service.ts` (ítem
 * H-4, adjunta el PDF al email de "factura creada") pueda importarla sin
 * crear un import circular entre los dos servicios — `facturacion.
 * service.ts` ya importa `NotificacionesService` como dependencia.
 */
export interface FacturaParaPdf {
  tipoFactura: TipoFactura;
  ncf: string | null;
  id: string;
  fecha: Date;
  cliente: { nombre: string };
  moneda: string;
  totalMoneda: Prisma.Decimal | null;
  lineas: {
    producto: { nombre: string } | null;
    descripcionManual: string | null;
    cantidad: Prisma.Decimal;
    precioUnitario: Prisma.Decimal;
    montoTotal: Prisma.Decimal;
  }[];
  recargos: { concepto: string; monto: Prisma.Decimal }[];
  subtotal: Prisma.Decimal;
  descuento: Prisma.Decimal;
  itbis: Prisma.Decimal;
  total: Prisma.Decimal;
}

export function mapearFacturaAParams(factura: FacturaParaPdf): DocumentoPdfParams {
  return {
    tipoDocumento: NOMBRE_TIPO_FACTURA[factura.tipoFactura],
    numero: factura.ncf ?? factura.id,
    fecha: factura.fecha,
    cliente: factura.cliente.nombre,
    lineas: factura.lineas.map((linea) => ({
      concepto: linea.producto?.nombre ?? linea.descripcionManual ?? '',
      cantidad: linea.cantidad.toString(),
      precioUnitario: Number(linea.precioUnitario).toFixed(2),
      total: Number(linea.montoTotal).toFixed(2),
    })),
    subtotal: Number(factura.subtotal),
    descuento: Number(factura.descuento),
    recargos: factura.recargos.map((r) => ({ concepto: r.concepto, monto: Number(r.monto) })),
    itbis: Number(factura.itbis),
    total: Number(factura.total),
    totalEnMoneda: factura.totalMoneda != null ? { moneda: factura.moneda, monto: Number(factura.totalMoneda) } : undefined,
  };
}
