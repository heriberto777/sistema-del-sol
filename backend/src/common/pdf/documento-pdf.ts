import PDFDocument from 'pdfkit';
import { formatearMontoDop } from './formato-monto';

const MARGEN = 40;
const ALTO_FILA = 20;

export interface LineaDocumentoPdf {
  concepto: string;
  cantidad: string;
  precioUnitario?: string;
  total?: string;
}

export interface DocumentoPdfParams {
  tipoDocumento: string;
  numero: string;
  fecha: Date;
  cliente: string;
  lineas: LineaDocumentoPdf[];
  /** Si es false (ej. remisiones, que no guardan precio), omite las columnas de precio/total y el resumen final. */
  mostrarPrecios?: boolean;
  subtotal?: number;
  descuento?: number;
  /** Ítem B-4 — cargos post-subtotal (Imprevistos, Viáticos, etc.), ya incluidos en `itbis`/`total`. */
  recargos?: { concepto: string; monto: number }[];
  itbis?: number;
  total?: number;
  notas?: string;
  /** Personalización de documentos (plan de integración Cuadre, ítem H-3) — logo como data URI y texto libre de pie de página. */
  logo?: string;
  notaPie?: string;
  /** Ítem C-2 (multi-moneda) — equivalente informativo, `total` de arriba sigue siendo siempre DOP. */
  totalEnMoneda?: { moneda: string; monto: number };
}

/**
 * Documento imprimible tipo factura/cotización/remisión — a diferencia de
 * `generarPdf` (tabla genérica de reportes), este incluye encabezado con
 * número/fecha/cliente y un resumen de totales al final.
 */
export function generarDocumentoPdf(
  params: DocumentoPdfParams,
  opciones?: { tamanoPagina?: 'letter' | 'a4' },
): Promise<Buffer> {
  const mostrarPrecios = params.mostrarPrecios ?? true;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: MARGEN, size: opciones?.tamanoPagina === 'a4' ? 'A4' : 'letter' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const anchoUtil = doc.page.width - MARGEN * 2;

    if (params.logo) {
      try {
        const base64 = params.logo.includes(',') ? params.logo.split(',')[1] : params.logo;
        doc.image(Buffer.from(base64, 'base64'), MARGEN, doc.y, { fit: [100, 60] });
        doc.moveDown(4.5);
      } catch {
        // Logo corrupto o formato no soportado por pdfkit — no bloquea la generación del documento.
      }
    }

    doc.font('Helvetica-Bold').fontSize(18).text(params.tipoDocumento, { width: anchoUtil });
    doc.font('Helvetica').fontSize(10);
    doc.text(`Número: ${params.numero}`);
    doc.text(`Fecha: ${params.fecha.toLocaleDateString('es-DO')}`);
    doc.text(`Cliente: ${params.cliente}`);
    doc.moveDown();

    const columnas = mostrarPrecios
      ? [
          { header: 'Concepto', width: anchoUtil * 0.45 },
          { header: 'Cantidad', width: anchoUtil * 0.15 },
          { header: 'Precio unit.', width: anchoUtil * 0.2 },
          { header: 'Total', width: anchoUtil * 0.2 },
        ]
      : [
          { header: 'Concepto', width: anchoUtil * 0.7 },
          { header: 'Cantidad', width: anchoUtil * 0.3 },
        ];

    function dibujarEncabezado() {
      doc.font('Helvetica-Bold').fontSize(9);
      let x = MARGEN;
      const y = doc.y;
      for (const columna of columnas) {
        doc.text(columna.header, x, y, { width: columna.width, ellipsis: true });
        x += columna.width;
      }
      doc.moveDown(0.7);
      doc.font('Helvetica').fontSize(9);
    }

    dibujarEncabezado();

    for (const linea of params.lineas) {
      if (doc.y + ALTO_FILA > doc.page.height - MARGEN) {
        doc.addPage();
        dibujarEncabezado();
      }
      const valores = mostrarPrecios
        ? [linea.concepto, linea.cantidad, linea.precioUnitario ?? '—', linea.total ?? '—']
        : [linea.concepto, linea.cantidad];
      let x = MARGEN;
      const y = doc.y;
      valores.forEach((valor, i) => {
        doc.text(valor, x, y, { width: columnas[i].width, ellipsis: true });
        x += columnas[i].width;
      });
      doc.moveDown(0.7);
    }

    if (mostrarPrecios) {
      doc.moveDown();
      doc.font('Helvetica').fontSize(10);
      if (params.subtotal !== undefined) doc.text(`Subtotal: ${formatearMontoDop(params.subtotal)}`, { align: 'right' });
      if (params.descuento) doc.text(`Descuento: ${formatearMontoDop(params.descuento)}`, { align: 'right' });
      for (const recargo of params.recargos ?? []) {
        doc.text(`${recargo.concepto}: ${formatearMontoDop(recargo.monto)}`, { align: 'right' });
      }
      if (params.itbis !== undefined) doc.text(`ITBIS: ${formatearMontoDop(params.itbis)}`, { align: 'right' });
      if (params.total !== undefined) doc.font('Helvetica-Bold').text(`Total: ${formatearMontoDop(params.total)}`, { align: 'right' });
      if (params.totalEnMoneda) {
        doc.font('Helvetica').fontSize(9).text(
          `Equivalente: ${params.totalEnMoneda.moneda} ${params.totalEnMoneda.monto.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          { align: 'right' },
        );
      }
    }

    if (params.notas) {
      doc.moveDown();
      doc.font('Helvetica').fontSize(9).text(`Notas: ${params.notas}`);
    }

    if (params.notaPie) {
      doc.moveDown();
      doc.font('Helvetica').fontSize(8).text(params.notaPie, { width: anchoUtil, align: 'center' });
    }

    doc.end();
  });
}
