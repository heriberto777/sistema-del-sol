import PDFDocument from 'pdfkit';
import { EmisorDocumentoPdf } from './documento-pdf';
import { formatearMontoDop } from './formato-monto';

const MARGEN = 40;
const ALTO_FILA = 20;

const ETIQUETA_TIPO_FACTURA: Record<string, string> = {
  CONTADO: 'Factura (contado)',
  CREDITO: 'Factura (crédito)',
  NOTA_CREDITO: 'Nota de crédito',
  NOTA_DEBITO: 'Nota de débito',
};

export interface LineaEstadoCuentaPdf {
  numero: string | null;
  ncf: string | null;
  tipoFactura: string;
  fecha: Date;
  total: number;
  saldoPendiente: number;
}

export interface EstadoCuentaPdfParams {
  cliente: { nombre: string; rncCedula?: string; email?: string; telefono?: string };
  emisor?: EmisorDocumentoPdf;
  desde: Date | null;
  hasta: Date | null;
  facturas: LineaEstadoCuentaPdf[];
  totalFacturado: number;
  totalPagado: number;
  saldoPendiente: number;
  logo?: string;
  notaPie?: string;
}

function formatearFecha(fecha: Date): string {
  return fecha.toLocaleDateString('es-DO');
}

/**
 * Un solo layout (a diferencia de las facturas, que tienen 4 diseños
 * seleccionables — ver documento-pdf.ts) porque es un documento nuevo,
 * sin una versión "clásica" previa que preservar ni pedido del usuario
 * de variantes visuales para este caso.
 */
export function generarEstadoCuentaPdf(params: EstadoCuentaPdfParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: MARGEN, size: 'letter' });
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
        // Logo corrupto — no bloquea la generación del documento.
      }
    }

    doc.font('Helvetica-Bold').fontSize(18).text('Estado de cuenta', { width: anchoUtil });

    if (params.emisor) {
      doc.font('Helvetica').fontSize(9);
      doc.text(params.emisor.nombre);
      if (params.emisor.rnc) doc.text(`RNC: ${params.emisor.rnc}`);
      if (params.emisor.direccion) doc.text(params.emisor.direccion);
      if (params.emisor.telefono) doc.text(`Tel: ${params.emisor.telefono}`);
    }
    doc.moveDown(0.8);

    doc.font('Helvetica-Bold').fontSize(11).text(params.cliente.nombre);
    doc.font('Helvetica').fontSize(9);
    if (params.cliente.rncCedula) doc.text(`RNC/Cédula: ${params.cliente.rncCedula}`);
    if (params.cliente.email) doc.text(params.cliente.email);
    if (params.cliente.telefono) doc.text(params.cliente.telefono);
    doc.moveDown(0.3);
    const periodo =
      params.desde || params.hasta
        ? `Período: ${params.desde ? formatearFecha(params.desde) : 'inicio'} — ${params.hasta ? formatearFecha(params.hasta) : 'hoy'}`
        : 'Período: histórico completo';
    doc.font('Helvetica').fontSize(9).fillColor('#6b7280').text(periodo);
    doc.fillColor('#000000');
    doc.moveDown();

    const columnas = [
      { header: 'Fecha', width: anchoUtil * 0.13 },
      { header: 'Tipo', width: anchoUtil * 0.24 },
      { header: 'Número', width: anchoUtil * 0.16 },
      { header: 'NCF', width: anchoUtil * 0.19 },
      { header: 'Total', width: anchoUtil * 0.14, align: 'right' as const },
      { header: 'Pendiente', width: anchoUtil * 0.14, align: 'right' as const },
    ];

    function dibujarEncabezado() {
      doc.font('Helvetica-Bold').fontSize(8.5);
      let x = MARGEN;
      const y = doc.y;
      for (const columna of columnas) {
        doc.text(columna.header, x, y, { width: columna.width, align: columna.align, ellipsis: true });
        x += columna.width;
      }
      doc.moveDown(0.6);
      doc.moveTo(MARGEN, doc.y).lineTo(MARGEN + anchoUtil, doc.y).lineWidth(1).strokeColor('#333333').stroke();
      doc.moveDown(0.4);
      doc.font('Helvetica').fontSize(9).strokeColor('#000000');
    }

    dibujarEncabezado();

    if (params.facturas.length === 0) {
      doc.font('Helvetica').fontSize(9.5).fillColor('#6b7280').text('Sin movimientos en el período.');
      doc.fillColor('#000000');
    }

    for (const linea of params.facturas) {
      if (doc.y + ALTO_FILA > doc.page.height - MARGEN - 90) {
        doc.addPage();
        doc.y = MARGEN;
        dibujarEncabezado();
      }
      const valores = [
        formatearFecha(linea.fecha),
        ETIQUETA_TIPO_FACTURA[linea.tipoFactura] ?? linea.tipoFactura,
        linea.numero ?? '—',
        linea.ncf ?? '—',
        formatearMontoDop(linea.total),
        linea.saldoPendiente > 0.005 ? formatearMontoDop(linea.saldoPendiente) : '—',
      ];
      let x = MARGEN;
      const y = doc.y;
      valores.forEach((valor, i) => {
        doc.text(valor, x, y, { width: columnas[i].width, align: columnas[i].align, ellipsis: true });
        x += columnas[i].width;
      });
      doc.moveDown(0.6);
      doc.moveTo(MARGEN, doc.y).lineTo(MARGEN + anchoUtil, doc.y).lineWidth(0.5).strokeColor('#e5e7eb').stroke();
      doc.moveDown(0.3);
    }

    doc.moveDown();
    const anchoResumen = 260;
    const xResumen = MARGEN + anchoUtil - anchoResumen;
    const anchoEtiqueta = anchoResumen * 0.5;
    const anchoValor = anchoResumen * 0.5;

    function filaResumen(etiqueta: string, valor: string, destacado = false) {
      const y = doc.y;
      doc.font(destacado ? 'Helvetica-Bold' : 'Helvetica').fontSize(destacado ? 12 : 10);
      doc.text(etiqueta, xResumen, y, { width: anchoEtiqueta });
      doc.text(valor, xResumen + anchoEtiqueta, y, { width: anchoValor, align: 'right' });
      doc.y = y + (destacado ? 18 : 15);
    }

    filaResumen('Total facturado:', formatearMontoDop(params.totalFacturado));
    filaResumen('Total pagado:', formatearMontoDop(params.totalPagado));
    filaResumen('Saldo pendiente:', formatearMontoDop(params.saldoPendiente), true);

    if (params.notaPie) {
      doc.moveDown();
      doc.font('Helvetica').fontSize(8).fillColor('#6b7280').text(params.notaPie, { width: anchoUtil, align: 'center' });
    }

    doc.end();
  });
}
