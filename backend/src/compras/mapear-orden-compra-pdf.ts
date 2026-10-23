import { Prisma } from '@prisma/client';
import { DocumentoPdfParams } from '../common/pdf/documento-pdf';

/**
 * Forma mínima que necesita `mapearOrdenCompraAParams` — mismo criterio
 * que mapear-factura-pdf.ts/mapear-cotizacion-pdf.ts. A diferencia de
 * Factura/Cotización, acá el "cliente" del documento impreso es el
 * PROVEEDOR al que se le compra — mismo slot de `DocumentoPdfParams.cliente`,
 * solo que representa al otro lado de la transacción. `user` es quien
 * CREÓ la orden (no hay concepto de "vendedor" en una compra) — mismo
 * slot que `responsableNombre` en Factura/Cotización/Remisión.
 */
export interface OrdenCompraParaPdf {
  numero: string;
  estado: string;
  fecha: Date;
  pagada: boolean;
  fechaPago: Date | null;
  proveedor: { nombre: string; rnc: string | null; telefono: string | null; email: string | null; plazoPagoDias: number };
  user: { nombre: string } | null;
  lineas: {
    producto: { nombre: string; codigo: string; categoria: { nombre: string } | null } | null;
    cantidad: Prisma.Decimal;
    costoUnitario: Prisma.Decimal;
    unidadMedida: { nombre: string } | null;
  }[];
  total: Prisma.Decimal;
}

export function mapearOrdenCompraAParams(orden: OrdenCompraParaPdf): DocumentoPdfParams {
  return {
    tipoDocumento: 'Orden de compra',
    numero: orden.numero,
    estado: orden.estado,
    fecha: orden.fecha,
    pagada: orden.pagada,
    fechaPago: orden.fechaPago ?? undefined,
    responsableNombre: orden.user?.nombre,
    cliente: orden.proveedor.nombre,
    clienteDatosExtra: {
      rnc: orden.proveedor.rnc ?? undefined,
      telefono: orden.proveedor.telefono ?? undefined,
      email: orden.proveedor.email ?? undefined,
      plazoPagoDias: orden.proveedor.plazoPagoDias,
    },
    lineas: orden.lineas.map((linea) => ({
      concepto: linea.producto?.nombre ?? '',
      cantidad: linea.cantidad.toString(),
      precioUnitario: Number(linea.costoUnitario).toFixed(2),
      total: (Number(linea.cantidad) * Number(linea.costoUnitario)).toFixed(2),
      codigo: linea.producto?.codigo,
      categoria: linea.producto?.categoria?.nombre,
      unidadMedida: linea.unidadMedida?.nombre,
    })),
    // OrdenCompra no guarda subtotal/descuento/itbis a nivel de cabecera
    // (solo `total`) — el bloque de totales ya tolera campos ausentes
    // (ver `totales` en documento-pdf-layout.ts), así que no hacen falta.
    total: Number(orden.total),
  };
}
