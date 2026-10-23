import { Prisma } from '@prisma/client';
import { DocumentoPdfParams } from '../common/pdf/documento-pdf';
import { formatearMontoDop } from '../common/pdf/formato-monto';

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
  estado: string;
  createdAt: Date;
  fechaVigenciaHasta: Date;
  motivoRechazo: string | null;
  vendedor: { nombre: string } | null;
  cliente: { nombre: string; rncCedula?: string | null; direccion?: string | null; telefono?: string | null; email?: string | null; nombreContacto?: string | null };
  lineas: {
    producto: { nombre: string; codigo: string; categoria: { nombre: string } | null } | null;
    descripcionManual: string | null;
    cantidad: Prisma.Decimal;
    precioUnitario: Prisma.Decimal;
    montoTotal: Prisma.Decimal;
    porcentajeItbis: Prisma.Decimal;
    descuento: Prisma.Decimal;
    unidadMedida: { nombre: string } | null;
  }[];
  subtotal: Prisma.Decimal;
  descuento: Prisma.Decimal;
  itbis: Prisma.Decimal;
  total: Prisma.Decimal;
  observaciones?: string | null;
}

export function mapearCotizacionAParams(cotizacion: CotizacionParaPdf): DocumentoPdfParams {
  return {
    tipoDocumento: 'Cotización',
    numero: cotizacion.numero,
    estado: cotizacion.estado,
    fecha: cotizacion.createdAt,
    fechaVencimiento: cotizacion.fechaVigenciaHasta,
    motivoRechazo: cotizacion.motivoRechazo ?? undefined,
    responsableNombre: cotizacion.vendedor?.nombre,
    cliente: cotizacion.cliente.nombre,
    clienteDatosExtra: {
      rnc: cotizacion.cliente.rncCedula ?? undefined,
      direccion: cotizacion.cliente.direccion ?? undefined,
      telefono: cotizacion.cliente.telefono ?? undefined,
      email: cotizacion.cliente.email ?? undefined,
      nombreContacto: cotizacion.cliente.nombreContacto ?? undefined,
    },
    lineas: cotizacion.lineas.map((linea) => ({
      concepto: linea.producto?.nombre ?? linea.descripcionManual ?? '',
      cantidad: linea.cantidad.toString(),
      precioUnitario: Number(linea.precioUnitario).toFixed(2),
      total: Number(linea.montoTotal).toFixed(2),
      codigo: linea.producto?.codigo,
      categoria: linea.producto?.categoria?.nombre,
      unidadMedida: linea.unidadMedida?.nombre,
      porcentajeItbis: `${Number(linea.porcentajeItbis)}%`,
      descuentoLinea: formatearMontoDop(Number(linea.descuento)),
    })),
    subtotal: Number(cotizacion.subtotal),
    descuento: Number(cotizacion.descuento),
    itbis: Number(cotizacion.itbis),
    total: Number(cotizacion.total),
    notas: cotizacion.observaciones ?? undefined,
  };
}
