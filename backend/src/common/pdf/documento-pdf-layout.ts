import PDFDocument from 'pdfkit';
import { formatearMontoDop } from './formato-monto';
import { ColumnaLinea, DocumentoPdfParams, FilaTotal, MARGEN, columnasActivas, insertarLogo, valorColumna } from './documento-pdf';
import { ClaveCampoDocumento, valorCampoDocumento } from './campos-documento';

const ALTO_FILA = 20;
/** Separación entre el final de la tabla (o de un "renglón" de bloques que fluyen) y lo siguiente. */
const ESPACIO_ENTRE_BLOQUES = 10;
/** Dos bloques "de abajo" se consideran del mismo renglón (van lado a lado) si su `y` original difiere en menos de esto, en % de la página. */
const TOLERANCIA_RENGLON_PCT = 3;

type TipoBloque = 'logo' | 'datos_empresa' | 'datos_cliente' | 'encabezado' | 'tabla_lineas' | 'totales' | 'qr' | 'firma' | 'texto_legal' | 'imagen_libre' | 'campo' | 'badge';

interface BloqueBase {
  tipo: TipoBloque;
  /** Posición/tamaño en PORCENTAJE (0-100) del área útil de la página (ya descontado el margen) — así el mismo layout sirve en Carta y A4. */
  x: number;
  y: number;
  w: number;
  h: number;
  /**
   * "Formato de Documentos" Fase F — color de fondo propio del bloque
   * (hex), independiente de `colorAcento`. Sin esto, el bloque no pinta
   * fondo (comportamiento de siempre). Aplica a CUALQUIER tipo de bloque,
   * no solo a los pensados para esto — ej. ponerle un fondo a un
   * `texto_legal` para que se vea como una franja de color.
   */
  colorFondo?: string;
  /** Color de texto propio del bloque — sin esto, usa el color por defecto de ese tipo de bloque (comportamiento de siempre). */
  colorTexto?: string;
}

export interface BloqueLogo extends BloqueBase {
  tipo: 'logo';
}
export interface BloqueDatosEmpresa extends BloqueBase {
  tipo: 'datos_empresa';
  campos?: ('rnc' | 'direccion' | 'telefono')[];
}
export interface BloqueDatosCliente extends BloqueBase {
  tipo: 'datos_cliente';
  campos?: ('rnc' | 'direccion' | 'telefono')[];
}
export interface BloqueEncabezado extends BloqueBase {
  tipo: 'encabezado';
}
export interface BloqueTablaLineas extends BloqueBase {
  tipo: 'tabla_lineas';
  columnas?: ColumnaLinea[];
  /** Fondo del renglón de encabezado de la tabla (ej. el azul del encabezado en una factura) — sin esto, sin fondo (de siempre). */
  colorEncabezado?: string;
  /** Color del texto del encabezado de la tabla — sin esto, blanco si hay `colorEncabezado`, o el color de texto normal si no. */
  colorTextoEncabezado?: string;
}
export interface BloqueTotales extends BloqueBase {
  tipo: 'totales';
  filas?: FilaTotal[];
}
export interface BloqueQr extends BloqueBase {
  tipo: 'qr';
}
export interface BloqueFirma extends BloqueBase {
  tipo: 'firma';
}
export interface BloqueTextoLegal extends BloqueBase {
  tipo: 'texto_legal';
}
export interface BloqueImagenLibre extends BloqueBase {
  tipo: 'imagen_libre';
  imagen: string;
}
/**
 * "Formato de Documentos" Fase D — bloque de un solo dato suelto (ver
 * campos-documento.ts), a diferencia de los grupos fijos de arriba
 * (`encabezado`, `datos_cliente`, etc.). Puede repetirse (no es un
 * BLOQUE_UNICO en el frontend) para poner, por ejemplo, el número de
 * documento en una esquina y la fecha en otra.
 */
export interface BloqueCampo extends BloqueBase {
  tipo: 'campo';
  campo: ClaveCampoDocumento;
  /** Prefijo opcional, ej. "Factura No." — sin esto, se imprime solo el valor. */
  etiqueta?: string;
}
/**
 * "Formato de Documentos" Fase F — pastilla de color (ej. "Pendiente" en
 * un rectángulo azul con esquinas redondeadas y texto blanco), igual
 * técnica que ya usaba la plantilla EDITORIAL de documento-pdf.ts para su
 * rótulo de tipo de documento — acá se expone como bloque posicionable y
 * con cualquier campo del catálogo (normalmente `estado`). Sin
 * `colorFondo`, usa `colorAcento` del tenant; sin `colorTexto`, blanco.
 */
export interface BloqueBadge extends BloqueBase {
  tipo: 'badge';
  campo: ClaveCampoDocumento;
}

export type BloqueLayout =
  | BloqueLogo
  | BloqueDatosEmpresa
  | BloqueDatosCliente
  | BloqueEncabezado
  | BloqueTablaLineas
  | BloqueTotales
  | BloqueQr
  | BloqueFirma
  | BloqueTextoLegal
  | BloqueImagenLibre
  | BloqueCampo
  | BloqueBadge;

export interface LayoutDocumento {
  bloques: BloqueLayout[];
}

/**
 * "Formato de Documentos" Fase C — motor de renderizado genérico para un
 * layout de bloques libres (editor de canvas), alternativa a las 5
 * `PlantillaDocumento` fijas de `documento-pdf.ts` (que siguen existiendo
 * sin cambios: esto es opt-in, solo se usa cuando
 * `PersonalizacionDocumentoTipo.layoutPersonalizado` no es null).
 *
 * Regla de desborde de la tabla (la única pieza no obvia de todo esto):
 * la tabla de líneas no tiene alto fijo. Los bloques ubicados ANTES de
 * ella (`y` menor) se dibujan en su posición absoluta, igual que
 * cualquier plantilla fija. Los bloques ubicados DESPUÉS (`y` mayor o
 * igual) no usan su `y` como coordenada absoluta — fluyen apenas termina
 * la tabla, en el orden en que estén ubicados verticalmente, agrupados
 * en "renglones" cuando su `y` es casi igual (para permitir, por
 * ejemplo, Totales + Firma + QR lado a lado). Si la tabla pagina
 * (muchas líneas), todo lo que fluye aparece recién en la última página
 * — igual criterio que ya usan las 5 plantillas fijas (el header del
 * documento no se repite en páginas de continuación).
 */
export function generarDocumentoPdfLayout(params: DocumentoPdfParams, layout: LayoutDocumento, opciones?: { tamanoPagina?: 'letter' | 'a4' }): Promise<Buffer> {
  const mostrarPrecios = params.mostrarPrecios ?? true;
  const colorAcento = params.colorAcento || '#1f2937';
  const colorTexto = '#1a1a1a';
  const colorGris = '#555555';

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: MARGEN, size: opciones?.tamanoPagina === 'a4' ? 'A4' : 'letter' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const anchoUtil = doc.page.width - MARGEN * 2;
    const altoUtil = doc.page.height - MARGEN * 2;
    const pct = (valor: number, base: number) => (valor / 100) * base;

    const tabla = layout.bloques.find((b): b is BloqueTablaLineas => b.tipo === 'tabla_lineas');
    const antes = tabla ? layout.bloques.filter((b) => b !== tabla && b.y < tabla.y) : layout.bloques;
    const despues = tabla ? layout.bloques.filter((b) => b !== tabla && b.y >= tabla.y) : [];

    for (const bloque of antes) {
      dibujarBloqueFijo(doc, bloque, {
        x: MARGEN + pct(bloque.x, anchoUtil),
        y: MARGEN + pct(bloque.y, altoUtil),
        w: pct(bloque.w, anchoUtil),
        h: pct(bloque.h, altoUtil),
        params,
        colorAcento,
        colorTexto,
        colorGris,
      });
    }

    let yActual = tabla ? MARGEN + pct(tabla.y, altoUtil) : MARGEN + pct(10, altoUtil);
    if (tabla) {
      doc.y = yActual;
      yActual = dibujarTabla(doc, params, mostrarPrecios, tabla.columnas, colorTexto, tabla.colorEncabezado, tabla.colorTextoEncabezado);
    }

    // Bloques que fluyen después de la tabla, agrupados en renglones por `y` original.
    const renglones = agruparEnRenglones(despues, TOLERANCIA_RENGLON_PCT);
    for (const renglon of renglones) {
      const altoRenglonEstimado = Math.max(...renglon.map((b) => pct(b.h, altoUtil)));
      if (yActual + altoRenglonEstimado > doc.page.height - MARGEN) {
        doc.addPage();
        yActual = MARGEN;
      }
      let yMaxRenglon = yActual;
      for (const bloque of renglon.sort((a, b) => a.x - b.x)) {
        const yFin = dibujarBloqueFluido(doc, bloque, {
          x: MARGEN + pct(bloque.x, anchoUtil),
          y: yActual,
          w: pct(bloque.w, anchoUtil),
          // Alto DECLARADO del bloque (el que el usuario fijó en el editor) — para el fondo de color
          // (Fase F). El contenido en sí sigue sin alto fijo (fluye según lo que ocupe).
          h: pct(bloque.h, altoUtil),
          params,
          colorAcento,
          colorTexto,
          colorGris,
        });
        yMaxRenglon = Math.max(yMaxRenglon, yFin);
      }
      yActual = yMaxRenglon + ESPACIO_ENTRE_BLOQUES;
    }

    doc.end();
  });
}

function agruparEnRenglones(bloques: BloqueLayout[], toleranciaPct: number): BloqueLayout[][] {
  const ordenados = [...bloques].sort((a, b) => a.y - b.y);
  const renglones: BloqueLayout[][] = [];
  for (const bloque of ordenados) {
    const ultimo = renglones[renglones.length - 1];
    if (ultimo && Math.abs(ultimo[0].y - bloque.y) <= toleranciaPct) {
      ultimo.push(bloque);
    } else {
      renglones.push([bloque]);
    }
  }
  return renglones;
}

interface ContextoDibujo {
  x: number;
  y: number;
  w: number;
  h?: number;
  params: DocumentoPdfParams;
  colorAcento: string;
  colorTexto: string;
  colorGris: string;
}

/** Bloques "de arriba" (antes de la tabla) — posición absoluta, no devuelven nada porque no afectan el flujo. */
function dibujarBloqueFijo(doc: PDFKit.PDFDocument, bloque: BloqueLayout, ctx: ContextoDibujo) {
  dibujarBloque(doc, bloque, ctx);
}

/** Bloques "de abajo" (después de la tabla) — devuelven el `y` donde terminó su contenido, para calcular el siguiente renglón. */
function dibujarBloqueFluido(doc: PDFKit.PDFDocument, bloque: BloqueLayout, ctx: ContextoDibujo): number {
  dibujarBloque(doc, bloque, ctx);
  return doc.y;
}

function dibujarBloque(doc: PDFKit.PDFDocument, bloque: BloqueLayout, ctx: ContextoDibujo) {
  const { x, y, w, params, colorAcento } = ctx;
  // El color propio del bloque (Fase F) pisa el genérico del contexto — sin esto, cero cambio de comportamiento.
  const colorTexto = bloque.colorTexto || ctx.colorTexto;
  const colorGris = bloque.colorTexto || ctx.colorGris;

  // Fondo del bloque — aplica a cualquier tipo salvo "badge" (dibuja su propia forma redondeada, no un rectángulo recto).
  if (bloque.colorFondo && bloque.tipo !== 'badge' && ctx.h !== undefined) {
    doc.rect(x, y, w, ctx.h).fillColor(bloque.colorFondo).fill();
  }

  switch (bloque.tipo) {
    case 'logo':
      insertarLogo(doc, params.logo, x, y, w, ctx.h ?? 60);
      doc.y = y + (ctx.h ?? 60);
      break;

    case 'imagen_libre':
      insertarLogo(doc, bloque.imagen, x, y, w, ctx.h ?? 60);
      doc.y = y + (ctx.h ?? 60);
      break;

    case 'datos_empresa': {
      doc.font('Helvetica-Bold').fontSize(11).fillColor(colorTexto).text(params.emisor?.nombre ?? '', x, y, { width: w });
      doc.font('Helvetica').fontSize(9).fillColor(colorGris);
      // Array vacío = mismo criterio que `undefined` (ver nota en documento-pdf.ts `totalesActivos`).
      const campos = bloque.campos && bloque.campos.length > 0 ? bloque.campos : ['rnc', 'direccion', 'telefono'];
      if (campos.includes('rnc') && params.emisor?.rnc) doc.text(`RNC: ${params.emisor.rnc}`, x, doc.y, { width: w });
      if (campos.includes('direccion') && params.emisor?.direccion) doc.text(params.emisor.direccion, x, doc.y, { width: w });
      if (campos.includes('telefono') && params.emisor?.telefono) doc.text(`Tel: ${params.emisor.telefono}`, x, doc.y, { width: w });
      break;
    }

    case 'datos_cliente': {
      doc.font('Helvetica-Bold').fontSize(11).fillColor(colorTexto).text(params.cliente, x, y, { width: w });
      doc.font('Helvetica').fontSize(9).fillColor(colorGris);
      const campos = bloque.campos && bloque.campos.length > 0 ? bloque.campos : ['rnc', 'direccion', 'telefono'];
      const extra = params.clienteDatosExtra;
      if (campos.includes('rnc') && extra?.rnc) doc.text(`RNC/Céd.: ${extra.rnc}`, x, doc.y, { width: w });
      if (campos.includes('direccion') && extra?.direccion) doc.text(extra.direccion, x, doc.y, { width: w });
      if (campos.includes('telefono') && extra?.telefono) doc.text(`Tel: ${extra.telefono}`, x, doc.y, { width: w });
      break;
    }

    case 'encabezado':
      doc.font('Helvetica-Bold').fontSize(16).fillColor(colorAcento).text(params.tipoDocumento, x, y, { width: w });
      doc.font('Helvetica').fontSize(10).fillColor(colorTexto).text(`No. ${params.numero}`, x, doc.y, { width: w });
      doc.font('Helvetica').fontSize(9).fillColor(colorTexto).text(params.fecha.toLocaleDateString('es-DO'), x, doc.y, { width: w });
      break;

    case 'totales': {
      const presentes: FilaTotal[] = [
        ...(params.subtotal !== undefined ? (['subtotal'] as const) : []),
        ...(params.descuento ? (['descuento'] as const) : []),
        ...(params.itbis !== undefined ? (['itbis'] as const) : []),
        ...(params.total !== undefined ? (['total'] as const) : []),
      ];
      const filasConfiguradas = bloque.filas && bloque.filas.length > 0 ? bloque.filas : presentes;
      const filasActivas = filasConfiguradas.filter((f) => presentes.includes(f));
      doc.y = y;
      doc.font('Helvetica').fontSize(9.5).fillColor(colorGris);
      if (filasActivas.includes('subtotal')) doc.text(`Subtotal: ${formatearMontoDop(params.subtotal!)}`, x, doc.y, { width: w, align: 'right' });
      if (filasActivas.includes('descuento')) doc.text(`Descuento: ${formatearMontoDop(params.descuento!)}`, x, doc.y, { width: w, align: 'right' });
      for (const recargo of params.recargos ?? []) doc.text(`${recargo.concepto}: ${formatearMontoDop(recargo.monto)}`, x, doc.y, { width: w, align: 'right' });
      if (filasActivas.includes('itbis')) doc.text(`ITBIS: ${formatearMontoDop(params.itbis!)}`, x, doc.y, { width: w, align: 'right' });
      if (filasActivas.includes('total')) doc.font('Helvetica-Bold').fontSize(13).fillColor(colorAcento).text(`Total: ${formatearMontoDop(params.total!)}`, x, doc.y, { width: w, align: 'right' });
      break;
    }

    case 'qr':
      if (params.qr?.dataUri) {
        try {
          const base64 = params.qr.dataUri.includes(',') ? params.qr.dataUri.split(',')[1] : params.qr.dataUri;
          doc.image(Buffer.from(base64, 'base64'), x, y, { fit: [Math.min(w, 80), Math.min(w, 80)] });
          doc.y = y + Math.min(w, 80);
          if (params.qr.etiqueta) doc.font('Helvetica').fontSize(7).fillColor(colorGris).text(params.qr.etiqueta, x, doc.y + 2, { width: w });
        } catch {
          doc.y = y;
        }
      } else {
        doc.y = y;
      }
      break;

    case 'firma':
      if (params.firma) {
        let yFirma = y;
        if (params.firma.imagen) {
          try {
            const base64 = params.firma.imagen.includes(',') ? params.firma.imagen.split(',')[1] : params.firma.imagen;
            doc.image(Buffer.from(base64, 'base64'), x, yFirma, { fit: [w, 40] });
            yFirma += 42;
          } catch {
            yFirma += 30;
          }
        } else {
          yFirma += 30;
        }
        doc.moveTo(x, yFirma).lineTo(x + Math.min(w, 160), yFirma).strokeColor(colorTexto).lineWidth(0.8).stroke();
        doc.font('Helvetica').fontSize(8).fillColor(colorGris).text(params.firma.etiqueta || 'Autorizado por', x, yFirma + 4, { width: w });
      } else {
        doc.y = y;
      }
      break;

    case 'texto_legal':
      doc.y = y;
      if (params.notaPie) doc.font('Helvetica').fontSize(8).fillColor(colorGris).text(params.notaPie, x, y, { width: w });
      break;

    case 'tabla_lineas':
      // Se maneja aparte en generarDocumentoPdfLayout (necesita paginación) — nunca llega hasta acá.
      break;

    case 'campo': {
      const valor = valorCampoDocumento(params, bloque.campo);
      doc.y = y;
      if (valor) {
        const prefijo = bloque.etiqueta ? `${bloque.etiqueta} ` : '';
        doc.font('Helvetica').fontSize(9.5).fillColor(colorTexto).text(`${prefijo}${valor}`, x, y, { width: w });
      }
      break;
    }

    case 'badge': {
      const valor = valorCampoDocumento(params, bloque.campo);
      doc.y = y;
      if (valor) {
        const alto = ctx.h ?? 18;
        const fondo = bloque.colorFondo || colorAcento;
        const texto = bloque.colorTexto || '#ffffff';
        doc.roundedRect(x, y, w, alto, alto / 2).fillColor(fondo).fill();
        doc.font('Helvetica-Bold').fontSize(9).fillColor(texto).text(valor, x, y + alto / 2 - 5, { width: w, align: 'center' });
        doc.y = y + alto;
      }
      break;
    }
  }
}

function dibujarTabla(
  doc: PDFKit.PDFDocument,
  params: DocumentoPdfParams,
  mostrarPrecios: boolean,
  columnasConfig: ColumnaLinea[] | undefined,
  colorTexto: string,
  colorEncabezado?: string,
  colorTextoEncabezado?: string,
): number {
  const anchoUtil = doc.page.width - MARGEN * 2;
  const activas = columnasActivas(mostrarPrecios, columnasConfig);
  const pesos: Record<ColumnaLinea, number> = {
    cantidad: 0.15,
    precioUnitario: 0.2,
    total: 0.2,
    codigo: 0.12,
    categoria: 0.15,
    unidadMedida: 0.12,
    porcentajeItbis: 0.1,
    descuentoLinea: 0.12,
  };
  const etiquetas: Record<ColumnaLinea, string> = {
    cantidad: 'Cantidad',
    precioUnitario: 'Precio unit.',
    total: 'Total',
    codigo: 'Código',
    categoria: 'Categoría',
    unidadMedida: 'Unidad',
    porcentajeItbis: 'ITBIS %',
    descuentoLinea: 'Descuento',
  };
  const anchoActivas = activas.reduce((s, c) => s + pesos[c], 0);
  const columnas = [{ header: 'Concepto', width: anchoUtil * (1 - anchoActivas) }, ...activas.map((c) => ({ header: etiquetas[c], width: anchoUtil * pesos[c] }))];

  function dibujarEncabezado() {
    const colorTextoCab = colorEncabezado ? colorTextoEncabezado || '#ffffff' : colorTexto;
    const y = doc.y;
    if (colorEncabezado) {
      doc.rect(MARGEN, y - 3, anchoUtil, ALTO_FILA).fillColor(colorEncabezado).fill();
    }
    doc.font('Helvetica-Bold').fontSize(9).fillColor(colorTextoCab);
    let x = MARGEN;
    for (const columna of columnas) {
      doc.text(columna.header, x, y, { width: columna.width, ellipsis: true });
      x += columna.width;
    }
    doc.y = y;
    doc.moveDown(0.7);
    if (!colorEncabezado) doc.moveTo(MARGEN, doc.y).lineTo(MARGEN + anchoUtil, doc.y).lineWidth(1).strokeColor(colorTexto).stroke();
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(9).fillColor(colorTexto);
  }

  dibujarEncabezado();

  for (const linea of params.lineas) {
    if (doc.y + ALTO_FILA > doc.page.height - MARGEN) {
      doc.addPage();
      doc.y = MARGEN;
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

  // A diferencia de las 5 plantillas fijas de documento-pdf.ts (que SÍ
  // imprimen `notas` automáticamente acá), en el layout de bloques libres
  // esto requiere un bloque `campo` explícito (clave 'observaciones') —
  // es justo el punto de la Fase D: que el usuario elija dónde va, en vez
  // de quedar pegado siempre después de la tabla.

  return doc.y;
}
