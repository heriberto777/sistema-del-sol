import { Prisma, TipoFactura } from '@prisma/client';
import { DocumentoPdfParams } from '../common/pdf/documento-pdf';
import { formatearMontoDop } from '../common/pdf/formato-monto';

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
  estado: string;
  ncf: string | null;
  tipoNcf: string | null;
  // Número interno de empresa (ver FacturacionService.crear) — se usa como
  // "número" del documento cuando no hay NCF (tenant sin comprobante
  // fiscal, ver Tenant.requiereComprobanteFiscal), en vez del id crudo.
  numero: string | null;
  id: string;
  fecha: Date;
  cliente: { nombre: string; rncCedula?: string | null; direccion?: string | null; telefono?: string | null; email?: string | null; nombreContacto?: string | null };
  moneda: string;
  tasaCambio: Prisma.Decimal | null;
  totalMoneda: Prisma.Decimal | null;
  plazoPagoDias: number;
  pagada: boolean;
  fechaPago: Date | null;
  motivoAnulacion: string | null;
  motivoNota: string | null;
  vendedor: { nombre: string } | null;
  formaPago: { nombre: string } | null;
  referenciaPago: string | null;
  bodega: { nombre: string } | null;
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
  recargos: { concepto: string; monto: Prisma.Decimal }[];
  subtotal: Prisma.Decimal;
  descuento: Prisma.Decimal;
  itbis: Prisma.Decimal;
  total: Prisma.Decimal;
  observaciones?: string | null;
}

export function mapearFacturaAParams(factura: FacturaParaPdf): DocumentoPdfParams {
  return {
    tipoDocumento: NOMBRE_TIPO_FACTURA[factura.tipoFactura],
    numero: factura.ncf ?? factura.numero ?? factura.id,
    numeroInterno: factura.numero ?? undefined,
    ncf: factura.ncf ?? undefined,
    tipoNcf: factura.tipoNcf ?? undefined,
    estado: factura.estado,
    fecha: factura.fecha,
    // Solo tiene sentido un vencimiento de crédito en una factura CREDITO —
    // en CONTADO el plazoPagoDias es un default sin efecto real (se cobra de una vez).
    fechaVencimiento:
      factura.tipoFactura === 'CREDITO' ? new Date(factura.fecha.getTime() + factura.plazoPagoDias * 86400000) : undefined,
    plazoPagoDias: factura.plazoPagoDias,
    responsableNombre: factura.vendedor?.nombre,
    formaPagoNombre: factura.formaPago?.nombre,
    referenciaPago: factura.referenciaPago ?? undefined,
    motivoNota: factura.motivoNota ?? undefined,
    motivoAnulacion: factura.motivoAnulacion ?? undefined,
    bodegaNombre: factura.bodega?.nombre,
    tasaCambio: factura.tasaCambio != null ? Number(factura.tasaCambio) : undefined,
    pagada: factura.pagada,
    fechaPago: factura.fechaPago ?? undefined,
    cliente: factura.cliente.nombre,
    clienteDatosExtra: {
      rnc: factura.cliente.rncCedula ?? undefined,
      direccion: factura.cliente.direccion ?? undefined,
      telefono: factura.cliente.telefono ?? undefined,
      email: factura.cliente.email ?? undefined,
      nombreContacto: factura.cliente.nombreContacto ?? undefined,
    },
    lineas: factura.lineas.map((linea) => ({
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
    subtotal: Number(factura.subtotal),
    descuento: Number(factura.descuento),
    recargos: factura.recargos.map((r) => ({ concepto: r.concepto, monto: Number(r.monto) })),
    itbis: Number(factura.itbis),
    total: Number(factura.total),
    totalEnMoneda: factura.totalMoneda != null ? { moneda: factura.moneda, monto: Number(factura.totalMoneda) } : undefined,
    notas: factura.observaciones ?? undefined,
  };
}
