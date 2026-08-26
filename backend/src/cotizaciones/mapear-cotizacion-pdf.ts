import { Prisma } from '@prisma/client';
import { DocumentoPdfParams } from '../common/pdf/documento-pdf';

/**
 * Forma mínima que necesita `mapearCotizacionAParams` — ver el comentario
 * equivalente en `facturacion/mapear-factura-pdf.ts`: vive en su propio
 * archivo (no dentro de `cotizaciones.service.ts`) para que
 * `notificaciones.service.ts` (ítem H-4, adjunta el PDF al email de
 * "cotización enviada") pueda importarla sin crear un import circular
 * entre los dos servicios.
 */
export interface CotizacionParaPdf {
  numero: string;
  createdAt: Date;
  cliente: { nombre: string };
  lineas: { producto: { nombre: string }; cantidad: Prisma.Decimal; precioUnitario: Prisma.Decimal; montoTotal: Prisma.Decimal }[];
  subtotal: Prisma.Decimal;
  descuento: Prisma.Decimal;
  itbis: Prisma.Decimal;
  total: Prisma.Decimal;
}

export function mapearCotizacionAParams(cotizacion: CotizacionParaPdf): DocumentoPdfParams {
  return {
    tipoDocumento: 'Cotización',
    numero: cotizacion.numero,
    fecha: cotizacion.createdAt,
    cliente: cotizacion.cliente.nombre,
    lineas: cotizacion.lineas.map((linea) => ({
      concepto: linea.producto.nombre,
      cantidad: linea.cantidad.toString(),
      precioUnitario: Number(linea.precioUnitario).toFixed(2),
      total: Number(linea.montoTotal).toFixed(2),
    })),
    subtotal: Number(cotizacion.subtotal),
    descuento: Number(cotizacion.descuento),
    itbis: Number(cotizacion.itbis),
    total: Number(cotizacion.total),
  };
}
