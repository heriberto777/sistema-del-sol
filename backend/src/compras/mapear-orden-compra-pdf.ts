import { Prisma } from '@prisma/client';
import { DocumentoPdfParams } from '../common/pdf/documento-pdf';

/**
 * Forma mínima que necesita `mapearOrdenCompraAParams` — mismo criterio
 * que mapear-factura-pdf.ts/mapear-cotizacion-pdf.ts. A diferencia de
 * Factura/Cotización, acá el "cliente" del documento impreso es el
 * PROVEEDOR al que se le compra — mismo slot de `DocumentoPdfParams.cliente`,
 * solo que representa al otro lado de la transacción.
 */
export interface OrdenCompraParaPdf {
  numero: string;
  fecha: Date;
  proveedor: { nombre: string; rnc: string | null; telefono: string | null };
  lineas: {
    producto: { nombre: string } | null;
    cantidad: Prisma.Decimal;
    costoUnitario: Prisma.Decimal;
  }[];
  total: Prisma.Decimal;
}

export function mapearOrdenCompraAParams(orden: OrdenCompraParaPdf): DocumentoPdfParams {
  return {
    tipoDocumento: 'Orden de compra',
    numero: orden.numero,
    fecha: orden.fecha,
    cliente: orden.proveedor.nombre,
    clienteDatosExtra: {
      rnc: orden.proveedor.rnc ?? undefined,
      telefono: orden.proveedor.telefono ?? undefined,
    },
    lineas: orden.lineas.map((linea) => ({
      concepto: linea.producto?.nombre ?? '',
      cantidad: linea.cantidad.toString(),
      precioUnitario: Number(linea.costoUnitario).toFixed(2),
      total: (Number(linea.cantidad) * Number(linea.costoUnitario)).toFixed(2),
    })),
    // OrdenCompra no guarda subtotal/descuento/itbis a nivel de cabecera
    // (solo `total`) — el bloque de totales ya tolera campos ausentes
    // (ver `totales` en documento-pdf-layout.ts), así que no hacen falta.
    total: Number(orden.total),
  };
}
