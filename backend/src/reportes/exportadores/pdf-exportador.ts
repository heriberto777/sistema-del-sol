import PDFDocument from 'pdfkit';

export interface ColumnaPdf {
  header: string;
  width: number;
}

const MARGEN = 40;
const ALTO_FILA = 20;

/**
 * Genera un PDF tabular simple (pdfkit no trae tablas de fábrica). Dibuja
 * el encabezado en cada página nueva cuando el contenido no entra en una
 * sola hoja.
 */
export function generarPdf(titulo: string, columnas: ColumnaPdf[], filas: string[][]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: MARGEN, size: 'letter' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const anchoUtil = doc.page.width - MARGEN * 2;

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

    doc.font('Helvetica-Bold').fontSize(16).text(titulo, { width: anchoUtil });
    doc.font('Helvetica').fontSize(9).text(`Generado: ${new Date().toLocaleString('es-DO')}`);
    doc.moveDown();

    dibujarEncabezado();

    for (const fila of filas) {
      if (doc.y + ALTO_FILA > doc.page.height - MARGEN) {
        doc.addPage();
        dibujarEncabezado();
      }
      let x = MARGEN;
      const y = doc.y;
      fila.forEach((valor, i) => {
        doc.text(valor, x, y, { width: columnas[i].width, ellipsis: true });
        x += columnas[i].width;
      });
      doc.moveDown(0.7);
    }

    doc.end();
  });
}
