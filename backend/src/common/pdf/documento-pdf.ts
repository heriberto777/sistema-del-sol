import PDFDocument from 'pdfkit';
import { PlantillaDocumento } from '@prisma/client';
import { formatearMontoDop } from './formato-monto';

/** Exportado para documento-pdf-layout.ts (Fase C — editor de bloques), que reusa el mismo margen/fila que las 5 plantillas fijas. */
export const MARGEN = 40;
const ALTO_FILA = 20;

export interface LineaDocumentoPdf {
  concepto: string;
  cantidad: string;
  precioUnitario?: string;
  total?: string;
}

export interface EmisorDocumentoPdf {
  nombre: string;
  rnc?: string;
  direccion?: string;
  telefono?: string;
}

/** Datos del cliente más allá del nombre (que sigue viajando en `DocumentoPdfParams.cliente`, sin cambios) — opcionales y aditivos, ver Fase A de "Formato de Documentos". */
export interface ClienteDatosExtraPdf {
  rnc?: string;
  direccion?: string;
  telefono?: string;
}

/** Imagen PNG ya generada por el caller (ver `backend/src/common/qr/generar-qr.ts`) — este módulo no sabe nada de códigos QR, solo la dibuja. */
export interface QrDocumentoPdf {
  dataUri: string;
  etiqueta?: string;
}

export interface FirmaDocumentoPdf {
  etiqueta?: string;
  imagen?: string;
}

export type ColumnaLinea = 'cantidad' | 'precioUnitario' | 'total';
export type FilaTotal = 'subtotal' | 'descuento' | 'itbis' | 'total';

export interface DocumentoPdfParams {
  tipoDocumento: string;
  numero: string;
  fecha: Date;
  cliente: string;
  /** Datos de la empresa emisora — antes solo lo usaba FacturaPlataforma; ahora también lo llena resolverPersonalizacionDocumento para el lado tenant (ver mapear-factura-plataforma-pdf.ts y resolver-personalizacion-documento.ts). */
  emisor?: EmisorDocumentoPdf;
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
  /** Color de acento del tenant (hex) — "Formato de Documentos" Fase A. Sin esto, cada plantilla usa su color original (cero cambio visual para quien no configuró nada). */
  colorAcento?: string;
  /** Qué campos del emisor dibujar además del nombre (que siempre se muestra). Sin esto: todos los presentes (comportamiento actual). */
  camposEmisorVisibles?: ('rnc' | 'direccion' | 'telefono')[];
  /** Datos del cliente más allá del nombre — "Formato de Documentos" Fase A. */
  clienteDatosExtra?: ClienteDatosExtraPdf;
  /** Qué campos del cliente dibujar además del nombre. Sin esto: ninguno (comportamiento actual, solo nombre). */
  camposClienteVisibles?: ('rnc' | 'direccion' | 'telefono')[];
  /** Columnas de la tabla de líneas a mostrar cuando `mostrarPrecios` es true. Sin esto: cantidad+precioUnitario+total (comportamiento actual). Ignorado si `mostrarPrecios` es false. */
  columnasLinea?: ColumnaLinea[];
  /** Filas del bloque de totales a mostrar. Sin esto: todas las que tengan valor (comportamiento actual). */
  totalesVisibles?: FilaTotal[];
  /** "Formato de Documentos" Fase B1 — código QR genérico (link de pago o texto libre), ya generado como imagen por el caller. */
  qr?: QrDocumentoPdf;
  /** "Formato de Documentos" Fase B1 — firma visual (línea + imagen opcional). En ECF_OFICIAL reemplaza la línea fija "Elaborado por"; en el resto es puramente aditivo. */
  firma?: FirmaDocumentoPdf;
}

/**
 * Documento imprimible tipo factura/cotización/remisión — a diferencia de
 * `generarPdf` (tabla genérica de reportes), este incluye encabezado con
 * número/fecha/cliente y un resumen de totales al final.
 *
 * `plantilla` es un eje independiente de `tamanoPagina` (ese es tamaño de
 * papel; esto es diseño visual — ver PlantillaDocumento en schema.prisma
 * y resolver-plantilla-documento.ts). CLASICO es el único que existía
 * antes de esto; las demás son puramente aditivas.
 */
export function generarDocumentoPdf(
  params: DocumentoPdfParams,
  opciones?: { tamanoPagina?: 'letter' | 'a4'; plantilla?: PlantillaDocumento },
): Promise<Buffer> {
  const mostrarPrecios = params.mostrarPrecios ?? true;
  const plantilla = opciones?.plantilla ?? 'CLASICO';

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: MARGEN, size: opciones?.tamanoPagina === 'a4' ? 'A4' : 'letter' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    switch (plantilla) {
      case 'ECF_OFICIAL':
        dibujarEcfOficial(doc, params, mostrarPrecios);
        break;
      case 'MINIMALISTA':
        dibujarMinimalista(doc, params, mostrarPrecios);
        break;
      case 'COMPACTO':
        dibujarCompacto(doc, params, mostrarPrecios);
        break;
      case 'EDITORIAL':
        dibujarEditorial(doc, params, mostrarPrecios);
        break;
      case 'CLASICO':
      default:
        dibujarClasico(doc, params, mostrarPrecios);
        break;
    }

    doc.end();
  });
}

/** Inserta el logo si hay uno y es un data URI decodificable — silencioso ante cualquier error, nunca bloquea el documento. Devuelve si lo pudo dibujar (para que quien llama decida si reserva espacio). Exportado: también lo usa documento-pdf-layout.ts para el bloque "imagen_libre" (misma decodificación, cualquier imagen). */
export function insertarLogo(doc: PDFKit.PDFDocument, logo: string | undefined, x: number, y: number, ancho: number, alto: number): boolean {
  if (!logo) return false;
  try {
    const base64 = logo.includes(',') ? logo.split(',')[1] : logo;
    doc.image(Buffer.from(base64, 'base64'), x, y, { fit: [ancho, alto] });
    return true;
  } catch {
    return false;
  }
}

/** Qué columnas de la tabla de líneas van activas, en orden fijo (concepto siempre va primero y no se puede ocultar). Exportado para documento-pdf-layout.ts. */
export function columnasActivas(mostrarPrecios: boolean, columnasLinea?: ColumnaLinea[]): ColumnaLinea[] {
  if (!mostrarPrecios) return ['cantidad'];
  if (columnasLinea && columnasLinea.length > 0) return (['cantidad', 'precioUnitario', 'total'] as ColumnaLinea[]).filter((c) => columnasLinea.includes(c));
  return ['cantidad', 'precioUnitario', 'total'];
}

export function valorColumna(linea: LineaDocumentoPdf, columna: ColumnaLinea): string {
  if (columna === 'cantidad') return linea.cantidad;
  if (columna === 'precioUnitario') return linea.precioUnitario ?? '—';
  return linea.total ?? '—';
}

/** Qué filas del bloque de totales van activas — por defecto, todas las que tengan un valor presente (comportamiento actual, sin romper nada). Exportado para documento-pdf-layout.ts. */
export function totalesActivos(params: DocumentoPdfParams): FilaTotal[] {
  const presentes: FilaTotal[] = [];
  if (params.subtotal !== undefined) presentes.push('subtotal');
  if (params.descuento) presentes.push('descuento');
  if (params.itbis !== undefined) presentes.push('itbis');
  if (params.total !== undefined) presentes.push('total');
  if (!params.totalesVisibles) return presentes;
  return presentes.filter((f) => params.totalesVisibles!.includes(f));
}

export function emisorCampoVisible(params: DocumentoPdfParams, campo: 'rnc' | 'direccion' | 'telefono'): boolean {
  return !params.camposEmisorVisibles || params.camposEmisorVisibles.includes(campo);
}

function clienteCampoVisible(params: DocumentoPdfParams, campo: 'rnc' | 'direccion' | 'telefono'): boolean {
  return !!params.camposClienteVisibles?.includes(campo) && !!params.clienteDatosExtra?.[campo];
}

/** Líneas extra del cliente (RNC/dirección/teléfono) a continuación del nombre — "Formato de Documentos" Fase A. Sin `camposClienteVisibles`/`clienteDatosExtra`, no dibuja nada (comportamiento actual). Exportado para documento-pdf-layout.ts. */
export function datosClienteExtra(params: DocumentoPdfParams): string[] {
  const lineas: string[] = [];
  if (clienteCampoVisible(params, 'rnc')) lineas.push(`RNC/Céd.: ${params.clienteDatosExtra!.rnc}`);
  if (clienteCampoVisible(params, 'direccion')) lineas.push(params.clienteDatosExtra!.direccion!);
  if (clienteCampoVisible(params, 'telefono')) lineas.push(`Tel: ${params.clienteDatosExtra!.telefono}`);
  return lineas;
}

/**
 * Pie de QR/firma — "Formato de Documentos" Fase B1. Puramente aditivo:
 * sin `params.qr` ni `params.firma`, no dibuja nada y no mueve `doc.y`
 * (cero cambio de layout para quien no configuró ninguno de los dos).
 * Se ubica en la posición actual del cursor (`doc.y`), lado a lado.
 */
function dibujarQrYFirma(doc: PDFKit.PDFDocument, params: DocumentoPdfParams, x: number, colorTexto: string, colorGris: string) {
  if (!params.qr && !params.firma) return;
  doc.moveDown(1.2);
  const yInicio = doc.y;
  let yMax = yInicio;

  if (params.qr?.dataUri) {
    try {
      const base64 = params.qr.dataUri.includes(',') ? params.qr.dataUri.split(',')[1] : params.qr.dataUri;
      doc.image(Buffer.from(base64, 'base64'), x, yInicio, { fit: [58, 58] });
      let y = yInicio + 60;
      if (params.qr.etiqueta) {
        doc.font('Helvetica').fontSize(7).fillColor(colorGris).text(params.qr.etiqueta, x, y, { width: 100 });
        y = doc.y;
      }
      yMax = Math.max(yMax, y);
    } catch {
      // Imagen de QR corrupta/ilegible — se omite en silencio, igual que insertarLogo.
    }
  }

  if (params.firma) {
    const xFirma = params.qr?.dataUri ? x + 120 : x;
    let yFirma = yInicio;
    if (params.firma.imagen) {
      try {
        const base64 = params.firma.imagen.includes(',') ? params.firma.imagen.split(',')[1] : params.firma.imagen;
        doc.image(Buffer.from(base64, 'base64'), xFirma, yFirma, { fit: [140, 40] });
        yFirma += 42;
      } catch {
        // Imagen de firma corrupta — se dibuja solo la línea.
      }
    } else {
      yFirma += 30;
    }
    doc.moveTo(xFirma, yFirma).lineTo(xFirma + 160, yFirma).strokeColor(colorTexto).lineWidth(0.8).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(colorGris).text(params.firma.etiqueta || 'Autorizado por', xFirma, yFirma + 4);
    yMax = Math.max(yMax, doc.y);
  }

  doc.y = yMax + 4;
}

// ============================================================================
// CLASICO — layout original (sin cambios de comportamiento respecto a antes
// de que existiera PlantillaDocumento).
// ============================================================================
function dibujarClasico(doc: PDFKit.PDFDocument, params: DocumentoPdfParams, mostrarPrecios: boolean) {
  const anchoUtil = doc.page.width - MARGEN * 2;
  const colorAcento = params.colorAcento || '#000000';
  const GRIS = '#444444';

  if (params.logo) {
    if (insertarLogo(doc, params.logo, MARGEN, doc.y, 100, 60)) doc.moveDown(4.5);
  }

  doc.font('Helvetica-Bold').fontSize(18).fillColor(colorAcento).text(params.tipoDocumento, { width: anchoUtil });

  if (params.emisor) {
    doc.font('Helvetica').fontSize(9).fillColor('#000000');
    doc.text(params.emisor.nombre);
    if (params.emisor.rnc && emisorCampoVisible(params, 'rnc')) doc.text(`RNC: ${params.emisor.rnc}`);
    if (params.emisor.direccion && emisorCampoVisible(params, 'direccion')) doc.text(params.emisor.direccion);
    if (params.emisor.telefono && emisorCampoVisible(params, 'telefono')) doc.text(`Tel: ${params.emisor.telefono}`);
    doc.moveDown(0.5);
  }

  doc.font('Helvetica').fontSize(10).fillColor('#000000');
  doc.text(`Número: ${params.numero}`);
  doc.text(`Fecha: ${params.fecha.toLocaleDateString('es-DO')}`);
  doc.text(`Cliente: ${params.cliente}`);
  for (const linea of datosClienteExtra(params)) doc.text(linea);
  doc.moveDown();

  const activas = columnasActivas(mostrarPrecios, params.columnasLinea);
  const pesos: Record<ColumnaLinea, number> = { cantidad: mostrarPrecios ? 0.15 : 0.3, precioUnitario: 0.2, total: 0.2 };
  const etiquetas: Record<ColumnaLinea, string> = { cantidad: 'Cantidad', precioUnitario: 'Precio unit.', total: 'Total' };
  const anchoColumnas = activas.reduce((suma, c) => suma + pesos[c], 0);
  const columnas = [{ header: 'Concepto', width: anchoUtil * (1 - anchoColumnas) }, ...activas.map((c) => ({ header: etiquetas[c], width: anchoUtil * pesos[c] }))];

  function dibujarEncabezado() {
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000');
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
    const valores = [linea.concepto, ...activas.map((c) => valorColumna(linea, c))];
    let x = MARGEN;
    const y = doc.y;
    valores.forEach((valor, i) => {
      doc.text(valor, x, y, { width: columnas[i].width, ellipsis: true });
      x += columnas[i].width;
    });
    doc.moveDown(0.7);
  }

  if (mostrarPrecios) {
    const filas = totalesActivos(params);
    doc.moveDown();
    doc.font('Helvetica').fontSize(10).fillColor('#000000');
    if (filas.includes('subtotal')) doc.text(`Subtotal: ${formatearMontoDop(params.subtotal!)}`, { align: 'right' });
    if (filas.includes('descuento')) doc.text(`Descuento: ${formatearMontoDop(params.descuento!)}`, { align: 'right' });
    for (const recargo of params.recargos ?? []) {
      doc.text(`${recargo.concepto}: ${formatearMontoDop(recargo.monto)}`, { align: 'right' });
    }
    if (filas.includes('itbis')) doc.text(`ITBIS: ${formatearMontoDop(params.itbis!)}`, { align: 'right' });
    if (filas.includes('total')) doc.font('Helvetica-Bold').fillColor(colorAcento).text(`Total: ${formatearMontoDop(params.total!)}`, { align: 'right' });
    if (params.totalEnMoneda) {
      doc.font('Helvetica').fontSize(9).fillColor('#000000').text(
        `Equivalente: ${params.totalEnMoneda.moneda} ${params.totalEnMoneda.monto.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        { align: 'right' },
      );
    }
  }

  if (params.notas) {
    doc.moveDown();
    doc.font('Helvetica').fontSize(9).fillColor('#000000').text(`Notas: ${params.notas}`);
  }

  dibujarQrYFirma(doc, params, MARGEN, '#000000', GRIS);

  if (params.notaPie) {
    doc.moveDown();
    doc.font('Helvetica').fontSize(8).fillColor('#000000').text(params.notaPie, { width: anchoUtil, align: 'center' });
  }
}

// ============================================================================
// ECF_OFICIAL — encabezado con regla gruesa, comprador en caja, totales en
// caja aparte y línea de firma. Inspirado en la representación impresa de
// un e-CF. El QR/código de seguridad REAL de la DGII no se dibuja acá
// todavía — "Formato de Documentos" Fase B2, bloqueada hasta confirmar qué
// devuelve Alanube al firmar (ver EmisionECfService). `params.qr`/
// `params.firma` genéricos (Fase B1) sí se pueden usar, a criterio del
// tenant, pero son un QR/firma propios, no el de la DGII.
// ============================================================================
function dibujarEcfOficial(doc: PDFKit.PDFDocument, params: DocumentoPdfParams, mostrarPrecios: boolean) {
  const anchoUtil = doc.page.width - MARGEN * 2;
  const NEGRO = '#1a1a1a';
  const GRIS = '#555555';
  const colorAcento = params.colorAcento || NEGRO;

  let yEmisor = MARGEN;
  if (params.logo && insertarLogo(doc, params.logo, MARGEN, MARGEN, 90, 50)) yEmisor = MARGEN;
  const xEmisor = params.logo ? MARGEN + 100 : MARGEN;
  const anchoEmisor = anchoUtil * 0.55 - (params.logo ? 100 : 0);

  doc.font('Helvetica-Bold').fontSize(12).fillColor(NEGRO).text(params.emisor?.nombre ?? '', xEmisor, yEmisor, { width: anchoEmisor });
  doc.font('Helvetica').fontSize(9).fillColor(GRIS);
  if (params.emisor?.rnc && emisorCampoVisible(params, 'rnc')) doc.text(`RNC: ${params.emisor.rnc}`, xEmisor, doc.y, { width: anchoEmisor });
  if (params.emisor?.direccion && emisorCampoVisible(params, 'direccion')) doc.text(params.emisor.direccion, xEmisor, doc.y, { width: anchoEmisor });
  if (params.emisor?.telefono && emisorCampoVisible(params, 'telefono')) doc.text(`Tel: ${params.emisor.telefono}`, xEmisor, doc.y, { width: anchoEmisor });

  const xDerecha = MARGEN + anchoUtil * 0.55;
  const anchoDerecha = anchoUtil * 0.45;
  doc.font('Helvetica-Bold').fontSize(15).fillColor(NEGRO).text(params.tipoDocumento, xDerecha, MARGEN, { width: anchoDerecha, align: 'right' });
  doc.font('Helvetica').fontSize(10).fillColor(NEGRO).text(`No. ${params.numero}`, xDerecha, doc.y + 4, { width: anchoDerecha, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor(GRIS);
  doc.text(`Fecha de emisión: ${params.fecha.toLocaleDateString('es-DO')}`, xDerecha, doc.y, { width: anchoDerecha, align: 'right' });

  const yTrasHeader = Math.max(doc.y, yEmisor + 70) + 10;
  doc.moveTo(MARGEN, yTrasHeader).lineTo(MARGEN + anchoUtil, yTrasHeader).lineWidth(1.5).strokeColor(colorAcento).stroke();

  const datosClienteLineas = datosClienteExtra(params);
  const altoCaja = 24 + datosClienteLineas.length * 11;
  const yCaja = yTrasHeader + 14;
  doc.roundedRect(MARGEN, yCaja, anchoUtil, altoCaja, 3).strokeColor('#999999').lineWidth(1).stroke();
  doc.font('Helvetica').fontSize(8).fillColor(GRIS).text('COMPRADOR', MARGEN + 10, yCaja + 8);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(NEGRO).text(params.cliente, MARGEN + 10, yCaja + 20);
  if (datosClienteLineas.length > 0) {
    doc.font('Helvetica').fontSize(8).fillColor(GRIS).text(datosClienteLineas.join('  ·  '), MARGEN + 10, yCaja + 34, { width: anchoUtil - 20 });
  }

  doc.y = yCaja + altoCaja + 18;

  const activas = columnasActivas(mostrarPrecios, params.columnasLinea);
  const pesos: Record<ColumnaLinea, number> = { cantidad: 0.12, precioUnitario: 0.16, total: 0.16 };
  const etiquetas: Record<ColumnaLinea, string> = { cantidad: 'Cant.', precioUnitario: 'Precio', total: 'Total' };
  const anchoActivas = activas.reduce((s, c) => s + pesos[c], 0);
  const columnas = [
    { header: 'Descripción', width: anchoUtil * (1 - anchoActivas), align: undefined as 'right' | undefined },
    ...activas.map((c) => ({ header: etiquetas[c], width: anchoUtil * pesos[c], align: 'right' as const })),
  ];

  function dibujarEncabezadoTabla() {
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(NEGRO);
    let x = MARGEN;
    const y = doc.y;
    for (const columna of columnas) {
      doc.text(columna.header.toUpperCase(), x, y, { width: columna.width, align: columna.align, ellipsis: true });
      x += columna.width;
    }
    doc.moveDown(0.6);
    doc.moveTo(MARGEN, doc.y).lineTo(MARGEN + anchoUtil, doc.y).lineWidth(1.2).strokeColor(NEGRO).stroke();
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(9).fillColor(NEGRO);
  }

  dibujarEncabezadoTabla();

  for (const linea of params.lineas) {
    if (doc.y + ALTO_FILA > doc.page.height - MARGEN - 110) {
      doc.addPage();
      doc.y = MARGEN;
      dibujarEncabezadoTabla();
    }
    const valores = [linea.concepto, ...activas.map((c) => valorColumna(linea, c))];
    let x = MARGEN;
    const y = doc.y;
    valores.forEach((valor, i) => {
      doc.text(valor, x, y, { width: columnas[i].width, align: columnas[i].align, ellipsis: true });
      x += columnas[i].width;
    });
    doc.moveDown(0.6);
    doc.moveTo(MARGEN, doc.y).lineTo(MARGEN + anchoUtil, doc.y).lineWidth(0.5).strokeColor('#dddddd').stroke();
    doc.moveDown(0.3);
  }

  if (mostrarPrecios) {
    const filasActivas = totalesActivos(params);
    doc.moveDown(0.5);
    const anchoCaja = 220;
    const xCaja = MARGEN + anchoUtil - anchoCaja;
    let yCajaTotales = doc.y;
    const filas: [string, string, boolean?][] = [];
    if (filasActivas.includes('subtotal')) filas.push(['Subtotal', formatearMontoDop(params.subtotal!)]);
    if (filasActivas.includes('descuento')) filas.push(['Descuento', formatearMontoDop(params.descuento!)]);
    for (const recargo of params.recargos ?? []) filas.push([recargo.concepto, formatearMontoDop(recargo.monto)]);
    if (filasActivas.includes('itbis')) filas.push(['ITBIS', formatearMontoDop(params.itbis!)]);
    if (filasActivas.includes('total')) filas.push(['TOTAL', formatearMontoDop(params.total!), true]);

    doc.rect(xCaja, yCajaTotales, anchoCaja, filas.length * 18 + 8).strokeColor(colorAcento).lineWidth(1).stroke();
    yCajaTotales += 6;
    for (const [etiqueta, valor, destacado] of filas) {
      doc.font(destacado ? 'Helvetica-Bold' : 'Helvetica').fontSize(destacado ? 11 : 9.5).fillColor(destacado ? colorAcento : NEGRO);
      doc.text(etiqueta, xCaja + 10, yCajaTotales, { width: anchoCaja - 100 });
      doc.text(valor, xCaja + 10, yCajaTotales, { width: anchoCaja - 20, align: 'right' });
      yCajaTotales += 18;
    }
    doc.y = yCajaTotales + 10;
  }

  if (params.notas) {
    doc.font('Helvetica').fontSize(8.5).fillColor(GRIS).text(`Notas: ${params.notas}`, MARGEN, doc.y, { width: anchoUtil * 0.6 });
  }

  doc.moveDown(2);
  const yFirma = Math.min(doc.y, doc.page.height - MARGEN - 30);
  doc.y = yFirma;
  if (params.firma || params.qr) {
    dibujarQrYFirma(doc, { ...params, firma: params.firma ?? { etiqueta: 'Elaborado por' } }, MARGEN, NEGRO, GRIS);
  } else {
    doc.moveTo(MARGEN, yFirma).lineTo(MARGEN + 160, yFirma).strokeColor(NEGRO).lineWidth(0.8).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(GRIS).text('Elaborado por', MARGEN, yFirma + 4);
  }

  if (params.notaPie) {
    doc.font('Helvetica').fontSize(8).fillColor(GRIS).text(params.notaPie, MARGEN, doc.page.height - MARGEN - 14, { width: anchoUtil, align: 'center' });
  }
}

// ============================================================================
// MINIMALISTA — dos columnas (emisor/cliente), título grande, tabla con
// subrayados y bloque de totales alineado a la derecha.
// ============================================================================
function dibujarMinimalista(doc: PDFKit.PDFDocument, params: DocumentoPdfParams, mostrarPrecios: boolean) {
  const anchoUtil = doc.page.width - MARGEN * 2;
  const OSCURO = '#1f2937';
  const GRIS = '#6b7280';
  const colorAcento = params.colorAcento || OSCURO;
  const mitad = anchoUtil / 2 - 10;

  let yInicio = MARGEN;
  if (params.logo && insertarLogo(doc, params.logo, MARGEN, MARGEN, 90, 50)) yInicio = MARGEN + 60;

  const yPartes = yInicio;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(OSCURO).text(params.emisor?.nombre ?? '', MARGEN, yPartes, { width: mitad });
  doc.font('Helvetica').fontSize(9).fillColor(GRIS);
  if (params.emisor?.rnc && emisorCampoVisible(params, 'rnc')) doc.text(`RNC ${params.emisor.rnc}`, MARGEN, doc.y, { width: mitad });
  if (params.emisor?.direccion && emisorCampoVisible(params, 'direccion')) doc.text(params.emisor.direccion, MARGEN, doc.y, { width: mitad });
  if (params.emisor?.telefono && emisorCampoVisible(params, 'telefono')) doc.text(params.emisor.telefono, MARGEN, doc.y, { width: mitad });
  const yFinEmisor = doc.y;

  const xDer = MARGEN + mitad + 20;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(OSCURO).text(params.cliente, xDer, yPartes, { width: mitad, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor(GRIS);
  for (const linea of datosClienteExtra(params)) doc.text(linea, xDer, doc.y, { width: mitad, align: 'right' });

  doc.y = Math.max(yFinEmisor, doc.y) + 22;
  doc.font('Helvetica-Bold').fontSize(28).fillColor(colorAcento).text(params.tipoDocumento.toUpperCase(), MARGEN, doc.y, { width: anchoUtil });
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor(GRIS).text(`Número: ${params.numero}   ·   Fecha: ${params.fecha.toLocaleDateString('es-DO')}`);
  doc.moveDown(1);

  const activas = columnasActivas(mostrarPrecios, params.columnasLinea);
  const pesos: Record<ColumnaLinea, number> = { cantidad: 0.14, precioUnitario: 0.23, total: 0.23 };
  const etiquetas: Record<ColumnaLinea, string> = { cantidad: 'Cant.', precioUnitario: 'Precio', total: 'Total' };
  const anchoActivas = activas.reduce((s, c) => s + pesos[c], 0);
  const columnas = [
    { header: 'Concepto', width: anchoUtil * (1 - anchoActivas), align: undefined as 'right' | undefined },
    ...activas.map((c) => ({ header: etiquetas[c], width: anchoUtil * pesos[c], align: 'right' as const })),
  ];

  function dibujarEncabezadoTabla() {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(OSCURO);
    let x = MARGEN;
    const y = doc.y;
    for (const columna of columnas) {
      doc.text(columna.header.toUpperCase(), x, y, { width: columna.width, align: columna.align });
      x += columna.width;
    }
    doc.moveDown(0.5);
    doc.moveTo(MARGEN, doc.y).lineTo(MARGEN + anchoUtil, doc.y).lineWidth(1.5).strokeColor(colorAcento).stroke();
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(9.5).fillColor(OSCURO);
  }

  dibujarEncabezadoTabla();

  for (const linea of params.lineas) {
    if (doc.y + ALTO_FILA > doc.page.height - MARGEN) {
      doc.addPage();
      doc.y = MARGEN;
      dibujarEncabezadoTabla();
    }
    const valores = [linea.concepto, ...activas.map((c) => valorColumna(linea, c))];
    let x = MARGEN;
    const y = doc.y;
    valores.forEach((valor, i) => {
      doc.text(valor, x, y, { width: columnas[i].width, align: columnas[i].align, ellipsis: true });
      x += columnas[i].width;
    });
    doc.moveDown(0.7);
    doc.moveTo(MARGEN, doc.y).lineTo(MARGEN + anchoUtil, doc.y).lineWidth(0.5).strokeColor('#e5e7eb').stroke();
    doc.moveDown(0.3);
  }

  if (mostrarPrecios) {
    const filasActivas = totalesActivos(params);
    doc.moveDown(0.5);
    const anchoCaja = 240;
    const xCaja = MARGEN + anchoUtil - anchoCaja;
    doc.font('Helvetica').fontSize(9.5).fillColor(GRIS);
    if (filasActivas.includes('subtotal')) doc.text(`Total base imponible    ${formatearMontoDop(params.subtotal!)}`, xCaja, doc.y, { width: anchoCaja, align: 'right' });
    if (filasActivas.includes('descuento')) doc.text(`Descuento    ${formatearMontoDop(params.descuento!)}`, xCaja, doc.y, { width: anchoCaja, align: 'right' });
    for (const recargo of params.recargos ?? []) doc.text(`${recargo.concepto}    ${formatearMontoDop(recargo.monto)}`, xCaja, doc.y, { width: anchoCaja, align: 'right' });
    if (filasActivas.includes('itbis')) doc.text(`Total ITBIS    ${formatearMontoDop(params.itbis!)}`, xCaja, doc.y, { width: anchoCaja, align: 'right' });
    if (filasActivas.includes('total')) {
      doc.moveDown(0.3);
      doc.moveTo(xCaja, doc.y).lineTo(xCaja + anchoCaja, doc.y).lineWidth(1.5).strokeColor(colorAcento).stroke();
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').fontSize(15).fillColor(colorAcento).text(`TOTAL    ${formatearMontoDop(params.total!)}`, xCaja, doc.y, { width: anchoCaja, align: 'right' });
    }
    if (params.totalEnMoneda) {
      doc.font('Helvetica').fontSize(9).fillColor(GRIS).text(
        `Equivalente: ${params.totalEnMoneda.moneda} ${params.totalEnMoneda.monto.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        xCaja,
        doc.y,
        { width: anchoCaja, align: 'right' },
      );
    }
  }

  doc.moveDown(2.5);
  if (params.notas) {
    doc.moveTo(MARGEN, doc.y).lineTo(MARGEN + anchoUtil, doc.y).lineWidth(0.5).strokeColor('#e5e7eb').stroke();
    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(OSCURO).text('Notas:', { continued: true }).font('Helvetica').fillColor(GRIS).text(` ${params.notas}`);
  }

  dibujarQrYFirma(doc, params, MARGEN, OSCURO, GRIS);

  if (params.notaPie) {
    doc.moveDown();
    doc.font('Helvetica').fontSize(8).fillColor(GRIS).text(params.notaPie, { width: anchoUtil });
  }
}

// ============================================================================
// COMPACTO — todo en recuadros (título, info, totales), tabla densa con
// filas alternadas. Estética de formulario oficial.
// ============================================================================
function dibujarCompacto(doc: PDFKit.PDFDocument, params: DocumentoPdfParams, mostrarPrecios: boolean) {
  const anchoUtil = doc.page.width - MARGEN * 2;
  const NEGRO = '#111111';
  const colorAcento = params.colorAcento || NEGRO;

  const anchoCajaTitulo = 190;
  const xCajaTitulo = MARGEN + anchoUtil - anchoCajaTitulo;
  doc.roundedRect(xCajaTitulo, MARGEN, anchoCajaTitulo, 36, 2).strokeColor(colorAcento).lineWidth(1.2).stroke();
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(colorAcento).text(params.tipoDocumento.toUpperCase(), xCajaTitulo, MARGEN + 6, { width: anchoCajaTitulo, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(9).fillColor(NEGRO).text(`No. ${params.numero}`, xCajaTitulo, MARGEN + 20, { width: anchoCajaTitulo, align: 'center' });

  const yLogo = MARGEN;
  const usoLogo = params.logo ? insertarLogo(doc, params.logo, MARGEN, MARGEN, 70, 40) : false;
  const xEmisor = usoLogo ? MARGEN + 80 : MARGEN;

  doc.font('Helvetica-Bold').fontSize(13).fillColor(NEGRO).text(params.emisor?.nombre?.toUpperCase() ?? '', xEmisor, yLogo, { width: xCajaTitulo - xEmisor - 16 });
  doc.font('Helvetica').fontSize(9).fillColor(NEGRO);
  const partesEmisor = [
    emisorCampoVisible(params, 'direccion') ? params.emisor?.direccion : undefined,
    emisorCampoVisible(params, 'rnc') && params.emisor?.rnc ? `RNC ${params.emisor.rnc}` : undefined,
  ]
    .filter(Boolean)
    .join(' — ');
  if (partesEmisor) doc.text(partesEmisor, xEmisor, doc.y, { width: xCajaTitulo - xEmisor - 16 });

  const yTrasHeader = Math.max(doc.y, MARGEN + 36) + 10;
  doc.moveTo(MARGEN, yTrasHeader).lineTo(MARGEN + anchoUtil, yTrasHeader).lineWidth(1).strokeColor(NEGRO).stroke();
  doc.y = yTrasHeader + 8;

  doc.font('Helvetica').fontSize(9.5).fillColor(NEGRO);
  doc.text(`Fecha: `, MARGEN, doc.y, { continued: true }).font('Helvetica-Bold').text(params.fecha.toLocaleDateString('es-DO'), { continued: true });
  doc.font('Helvetica').text(`     Cliente: `, { continued: true }).font('Helvetica-Bold').text(params.cliente);
  const datosClienteLineas = datosClienteExtra(params);
  if (datosClienteLineas.length > 0) {
    doc.font('Helvetica').fontSize(8.5).fillColor('#444444').text(datosClienteLineas.join('   ·   '), MARGEN, doc.y);
  }
  doc.moveDown(0.6);
  doc.moveTo(MARGEN, doc.y).lineTo(MARGEN + anchoUtil, doc.y).lineWidth(1).strokeColor(NEGRO).stroke();
  doc.moveDown(0.6);

  const activas = columnasActivas(mostrarPrecios, params.columnasLinea);
  const pesos: Record<ColumnaLinea, number> = { cantidad: 0.13, precioUnitario: 0.22, total: 0.23 };
  const etiquetas: Record<ColumnaLinea, string> = { cantidad: 'Cant.', precioUnitario: 'Valor Unit.', total: 'Valor' };
  const anchoActivas = activas.reduce((s, c) => s + pesos[c], 0);
  const columnas = [
    { header: 'Descripción', width: anchoUtil * (1 - anchoActivas), align: undefined as 'right' | undefined },
    ...activas.map((c) => ({ header: etiquetas[c], width: anchoUtil * pesos[c], align: 'right' as const })),
  ];

  function dibujarEncabezadoTabla() {
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(NEGRO);
    let x = MARGEN;
    const y = doc.y;
    for (const columna of columnas) {
      doc.text(columna.header, x, y, { width: columna.width, align: columna.align });
      x += columna.width;
    }
    doc.moveDown(0.5);
    doc.moveTo(MARGEN, doc.y).lineTo(MARGEN + anchoUtil, doc.y).lineWidth(1).strokeColor(NEGRO).stroke();
    doc.moveDown(0.3);
  }

  dibujarEncabezadoTabla();

  let filaPar = false;
  for (const linea of params.lineas) {
    if (doc.y + ALTO_FILA > doc.page.height - MARGEN) {
      doc.addPage();
      doc.y = MARGEN;
      dibujarEncabezadoTabla();
      filaPar = false;
    }
    const yFila = doc.y;
    if (filaPar) doc.rect(MARGEN, yFila - 2, anchoUtil, 17).fillColor('#f2f2f2').fill();
    filaPar = !filaPar;

    doc.font('Helvetica').fontSize(9).fillColor(NEGRO);
    const valores = [linea.concepto, ...activas.map((c) => valorColumna(linea, c))];
    let x = MARGEN;
    valores.forEach((valor, i) => {
      doc.text(valor, x, yFila, { width: columnas[i].width, align: columnas[i].align, ellipsis: true });
      x += columnas[i].width;
    });
    doc.y = yFila + 17;
  }
  doc.moveTo(MARGEN, doc.y).lineTo(MARGEN + anchoUtil, doc.y).lineWidth(1).strokeColor(NEGRO).stroke();

  if (mostrarPrecios) {
    const filasActivas = totalesActivos(params);
    doc.moveDown(0.8);
    const anchoCaja = 230;
    const xCaja = MARGEN + anchoUtil - anchoCaja;
    const filas: [string, string, boolean?][] = [];
    if (filasActivas.includes('subtotal')) filas.push(['Valor Venta', formatearMontoDop(params.subtotal!)]);
    if (filasActivas.includes('descuento')) filas.push(['Descuentos', formatearMontoDop(params.descuento!)]);
    for (const recargo of params.recargos ?? []) filas.push([recargo.concepto, formatearMontoDop(recargo.monto)]);
    if (filasActivas.includes('itbis')) filas.push(['ITBIS (18%)', formatearMontoDop(params.itbis!)]);
    if (filasActivas.includes('total')) filas.push(['IMPORTE TOTAL', formatearMontoDop(params.total!), true]);

    let y = doc.y;
    for (const [etiqueta, valor, destacado] of filas) {
      doc.rect(xCaja, y, anchoCaja, 20).strokeColor(destacado ? colorAcento : NEGRO).lineWidth(destacado ? 1.4 : 0.8).stroke();
      doc.font(destacado ? 'Helvetica-Bold' : 'Helvetica').fontSize(destacado ? 10.5 : 9).fillColor(destacado ? colorAcento : NEGRO);
      doc.text(etiqueta, xCaja + 8, y + 6, { width: anchoCaja / 2 });
      doc.text(valor, xCaja + anchoCaja / 2, y + 6, { width: anchoCaja / 2 - 10, align: 'right' });
      y += 20;
    }
    doc.y = y + 10;
  }

  if (params.notas) {
    doc.font('Helvetica').fontSize(8.5).fillColor('#444444').text(`Notas: ${params.notas}`, MARGEN, doc.y, { width: anchoUtil * 0.6 });
  }

  dibujarQrYFirma(doc, params, MARGEN, NEGRO, '#444444');

  if (params.notaPie) {
    doc.font('Helvetica').fontSize(8).fillColor('#444444').text(params.notaPie, MARGEN, doc.page.height - MARGEN - 14, { width: anchoUtil, align: 'center' });
  }
}

// ============================================================================
// EDITORIAL — franja de color superior, insignia con iniciales, acentos de
// color en encabezados y total. Pensado para negocios donde la marca
// importa tanto como el dato fiscal.
// ============================================================================
function dibujarEditorial(doc: PDFKit.PDFDocument, params: DocumentoPdfParams, mostrarPrecios: boolean) {
  const anchoTotal = doc.page.width;
  const anchoUtil = doc.page.width - MARGEN * 2;
  const ACENTO = params.colorAcento || '#8a3b1f';
  const OSCURO = '#241a12';
  const GRIS = '#7a6a5c';

  doc.rect(0, 0, anchoTotal, 10).fillColor(ACENTO).fill();

  const yInicio = 32;
  const logoUsado = params.logo ? insertarLogo(doc, params.logo, MARGEN, yInicio, 46, 46) : false;
  if (!logoUsado) {
    const iniciales = (params.emisor?.nombre ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '—';
    doc.roundedRect(MARGEN, yInicio, 46, 46, 8).fillColor(ACENTO).fill();
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#ffffff').text(iniciales, MARGEN, yInicio + 15, { width: 46, align: 'center' });
  }

  const xNombre = MARGEN + 58;
  doc.font('Helvetica-Bold').fontSize(14).fillColor(OSCURO).text(params.emisor?.nombre ?? '', xNombre, yInicio + 2, { width: anchoUtil * 0.5 - 58 });
  doc.font('Helvetica').fontSize(8.5).fillColor(GRIS);
  const datosEmisor = [
    emisorCampoVisible(params, 'rnc') && params.emisor?.rnc ? `RNC ${params.emisor.rnc}` : undefined,
    emisorCampoVisible(params, 'direccion') ? params.emisor?.direccion : undefined,
    emisorCampoVisible(params, 'telefono') ? params.emisor?.telefono : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
  if (datosEmisor) doc.text(datosEmisor, xNombre, doc.y, { width: anchoUtil * 0.5 - 58 });

  const xDer = MARGEN + anchoUtil * 0.55;
  const anchoDer = anchoUtil * 0.45;
  const rotuloAncho = doc.font('Helvetica-Bold').fontSize(9).widthOfString(params.tipoDocumento.toUpperCase()) + 20;
  doc.roundedRect(MARGEN + anchoUtil - rotuloAncho, yInicio, rotuloAncho, 18, 9).fillColor(ACENTO).fill();
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff').text(params.tipoDocumento.toUpperCase(), MARGEN + anchoUtil - rotuloAncho, yInicio + 5, { width: rotuloAncho, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(15).fillColor(OSCURO).text(`No. ${params.numero}`, xDer, yInicio + 22, { width: anchoDer, align: 'right' });
  doc.font('Helvetica').fontSize(8.5).fillColor(GRIS).text(params.fecha.toLocaleDateString('es-DO'), xDer, doc.y, { width: anchoDer, align: 'right' });

  doc.y = yInicio + 70;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(ACENTO).text('FACTURADO A');
  doc.font('Helvetica-Bold').fontSize(11).fillColor(OSCURO).text(params.cliente);
  doc.font('Helvetica').fontSize(8.5).fillColor(GRIS);
  for (const linea of datosClienteExtra(params)) doc.text(linea);
  doc.moveDown(1);

  const activas = columnasActivas(mostrarPrecios, params.columnasLinea);
  const pesos: Record<ColumnaLinea, number> = { cantidad: 0.14, precioUnitario: 0.21, total: 0.21 };
  const etiquetas: Record<ColumnaLinea, string> = { cantidad: 'Cant.', precioUnitario: 'Precio', total: 'Total' };
  const anchoActivas = activas.reduce((s, c) => s + pesos[c], 0);
  const columnas = [
    { header: 'Descripción', width: anchoUtil * (1 - anchoActivas), align: undefined as 'right' | undefined },
    ...activas.map((c) => ({ header: etiquetas[c], width: anchoUtil * pesos[c], align: 'right' as const })),
  ];

  function dibujarEncabezadoTabla() {
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(ACENTO);
    let x = MARGEN;
    const y = doc.y;
    for (const columna of columnas) {
      doc.text(columna.header.toUpperCase(), x, y, { width: columna.width, align: columna.align });
      x += columna.width;
    }
    doc.moveDown(0.5);
    doc.moveTo(MARGEN, doc.y).lineTo(MARGEN + anchoUtil, doc.y).lineWidth(1.5).strokeColor(ACENTO).stroke();
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(9.5).fillColor(OSCURO);
  }

  dibujarEncabezadoTabla();

  for (const linea of params.lineas) {
    if (doc.y + ALTO_FILA > doc.page.height - MARGEN) {
      doc.addPage();
      doc.y = MARGEN;
      dibujarEncabezadoTabla();
    }
    const valores = [linea.concepto, ...activas.map((c) => valorColumna(linea, c))];
    let x = MARGEN;
    const y = doc.y;
    valores.forEach((valor, i) => {
      doc.text(valor, x, y, { width: columnas[i].width, align: columnas[i].align, ellipsis: true });
      x += columnas[i].width;
    });
    doc.moveDown(0.7);
    doc.moveTo(MARGEN, doc.y).lineTo(MARGEN + anchoUtil, doc.y).lineWidth(0.5).strokeColor('#eee1d6').stroke();
    doc.moveDown(0.3);
  }

  if (mostrarPrecios) {
    const filasActivas = totalesActivos(params);
    doc.moveDown(0.5);
    const anchoCaja = 230;
    const xCaja = MARGEN + anchoUtil - anchoCaja;
    doc.font('Helvetica').fontSize(9.5).fillColor(GRIS);
    if (filasActivas.includes('subtotal')) doc.text(`Subtotal    ${formatearMontoDop(params.subtotal!)}`, xCaja, doc.y, { width: anchoCaja, align: 'right' });
    if (filasActivas.includes('descuento')) doc.text(`Descuento    ${formatearMontoDop(params.descuento!)}`, xCaja, doc.y, { width: anchoCaja, align: 'right' });
    for (const recargo of params.recargos ?? []) doc.text(`${recargo.concepto}    ${formatearMontoDop(recargo.monto)}`, xCaja, doc.y, { width: anchoCaja, align: 'right' });
    if (filasActivas.includes('itbis')) doc.text(`ITBIS    ${formatearMontoDop(params.itbis!)}`, xCaja, doc.y, { width: anchoCaja, align: 'right' });
    if (filasActivas.includes('total')) {
      doc.moveDown(0.3);
      doc.moveTo(xCaja, doc.y).lineTo(xCaja + anchoCaja, doc.y).lineWidth(1.5).strokeColor(ACENTO).stroke();
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').fontSize(16).fillColor(ACENTO).text(`Total    ${formatearMontoDop(params.total!)}`, xCaja, doc.y, { width: anchoCaja, align: 'right' });
    }
  }

  dibujarQrYFirma(doc, params, MARGEN, OSCURO, GRIS);

  doc.moveDown(2);
  if (params.notas || params.notaPie) {
    const yCaja = doc.y;
    const alto = 40;
    doc.roundedRect(MARGEN, yCaja, anchoUtil, alto, 8).fillColor('#faf3ec').fill();
    doc.font('Helvetica').fontSize(9).fillColor(GRIS).text([params.notas, params.notaPie].filter(Boolean).join(' — '), MARGEN + 14, yCaja + 12, { width: anchoUtil - 28 });
  }
}
