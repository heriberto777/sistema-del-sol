import { Prisma } from '@prisma/client';
import { DocumentoPdfParams, EmisorDocumentoPdf } from '../common/pdf/documento-pdf';

/** Forma mínima que necesita el mapeo — ver mapear-factura-pdf.ts (lado tenant) para el mismo criterio de interfaz reducida. */
export interface FacturaPlataformaParaPdf {
  id: string;
  ncf: string | null;
  concepto: string;
  monto: Prisma.Decimal;
  descuento: Prisma.Decimal;
  montoMora: Prisma.Decimal;
  total: Prisma.Decimal;
  fechaEmision: Date;
  tenant: { nombre: string; rnc: string | null };
  lineas: { concepto: string; monto: Prisma.Decimal }[];
}

export function mapearFacturaPlataformaAParams(factura: FacturaPlataformaParaPdf, emisor?: EmisorDocumentoPdf): DocumentoPdfParams {
  const lineas =
    factura.lineas.length > 0
      ? factura.lineas.map((l) => ({ concepto: l.concepto, cantidad: '1', precioUnitario: Number(l.monto).toFixed(2), total: Number(l.monto).toFixed(2) }))
      : [{ concepto: factura.concepto, cantidad: '1', precioUnitario: Number(factura.monto).toFixed(2), total: Number(factura.monto).toFixed(2) }];

  const montoMora = Number(factura.montoMora);

  return {
    tipoDocumento: 'Factura',
    numero: factura.ncf ?? factura.id,
    fecha: factura.fechaEmision,
    cliente: factura.tenant.rnc ? `${factura.tenant.nombre} — RNC ${factura.tenant.rnc}` : factura.tenant.nombre,
    emisor,
    lineas,
    subtotal: Number(factura.monto),
    descuento: Number(factura.descuento),
    recargos: montoMora > 0 ? [{ concepto: 'Mora', monto: montoMora }] : [],
    total: Number(factura.total),
  };
}
