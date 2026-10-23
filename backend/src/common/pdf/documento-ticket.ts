import { DocumentoPdfParams, datosClienteExtra } from './documento-pdf';
import { formatearMontoDop } from './formato-monto';
import { ClaveCampoDocumento, valorCampoDocumento } from './campos-documento';

export type AnchoTicket = 'TERMICA_80MM' | 'TERMICA_58MM';

const DIMENSIONES: Record<AnchoTicket, { pageSize: string; margin: string; fontSize: string }> = {
  TERMICA_80MM: { pageSize: '80mm auto', margin: '3mm', fontSize: '11px' },
  TERMICA_58MM: { pageSize: '58mm auto', margin: '2mm', fontSize: '9.5px' },
};

/**
 * "Formato de Documentos" Fase G — editor básico para el ticket térmico:
 * a diferencia del canvas de Carta/A4 (posición libre x/y, que no tiene
 * sentido en un rollo continuo sin alto fijo y demasiado angosto para
 * columnas lado a lado), acá el layout es una lista ORDENADA de bloques
 * que se apilan verticalmente — el orden del array ES el orden de
 * impresión, y un bloque ausente simplemente no se imprime.
 */
export type TipoBloqueTermico = 'logo' | 'encabezado' | 'cliente' | 'tabla_lineas' | 'totales' | 'campo' | 'observaciones' | 'texto_legal';

export interface BloqueTermico {
  tipo: TipoBloqueTermico;
  /** Solo para tipo "campo" — ver ClaveCampoDocumento. */
  campo?: ClaveCampoDocumento;
  /** Solo para tipo "campo" — prefijo opcional, ej. "Mesa:". */
  etiqueta?: string;
}

export interface LayoutTermico {
  bloques: BloqueTermico[];
}

/**
 * A diferencia de PDFKit (que nunca interpreta su texto como markup),
 * este documento se arma por concatenación de strings y se abre en una
 * pestaña real del navegador — cliente/concepto/numero/notas vienen de
 * la base y pueden ser influenciados por el usuario final (nombre de
 * producto, nombre de cliente). Sin escapar esto sería un XSS real.
 */
function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Ticket angosto tipo impresora térmica — sibling de generarDocumentoPdf,
 * consume la MISMA forma de datos (DocumentoPdfParams) para no duplicar
 * la lógica de negocio que ya arma cada servicio (Facturación/
 * Cotizaciones/Remisiones). Layout apilado (no tabla de columnas fija):
 * el ancho angosto no alcanza para columnas alineadas de forma legible.
 *
 * Sin `layoutTermico` (el caso de todo tenant que nunca abrió el editor
 * de ticket), el cuerpo es EXACTAMENTE el de siempre — ningún cambio de
 * comportamiento. Con `layoutTermico`, el cuerpo se arma bloque por
 * bloque en el orden configurado.
 */
export function generarDocumentoTicketHtml(params: DocumentoPdfParams, ancho: AnchoTicket, layoutTermico?: LayoutTermico | null): string {
  const mostrarPrecios = params.mostrarPrecios ?? true;
  const { pageSize, margin, fontSize } = DIMENSIONES[ancho];
  const e = escaparHtml;

  const lineasHtml = params.lineas
    .map((linea) => {
      const filaConcepto = `<div class="concepto">${e(linea.cantidad)} ${e(linea.concepto)}</div>`;
      if (!mostrarPrecios) return `<div class="linea">${filaConcepto}</div>`;
      const filaMontos = `<div class="fila-montos"><span>${e(linea.precioUnitario ?? '—')}</span><span>${e(linea.total ?? '—')}</span></div>`;
      return `<div class="linea">${filaConcepto}${filaMontos}</div>`;
    })
    .join('');

  const totalesHtml = mostrarPrecios
    ? `<div class="totales">
        ${params.subtotal !== undefined ? `<div class="fila-montos"><span>Subtotal</span><span>${e(formatearMontoDop(params.subtotal))}</span></div>` : ''}
        ${params.descuento ? `<div class="fila-montos"><span>Descuento</span><span>${e(formatearMontoDop(params.descuento))}</span></div>` : ''}
        ${(params.recargos ?? []).map((r) => `<div class="fila-montos"><span>${e(r.concepto)}</span><span>${e(formatearMontoDop(r.monto))}</span></div>`).join('')}
        ${params.itbis !== undefined ? `<div class="fila-montos"><span>ITBIS</span><span>${e(formatearMontoDop(params.itbis))}</span></div>` : ''}
        ${params.total !== undefined ? `<div class="fila-montos total"><span>Total</span><span>${e(formatearMontoDop(params.total))}</span></div>` : ''}
        ${params.totalEnMoneda ? `<div class="fila-montos"><span>Equivalente</span><span>${e(params.totalEnMoneda.moneda)} ${e(params.totalEnMoneda.monto.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}</span></div>` : ''}
      </div>`
    : '';

  const cuerpo = layoutTermico
    ? layoutTermico.bloques.map((bloque) => renderBloqueTermico(bloque, params, e, lineasHtml, totalesHtml)).join('')
    : `<div class="encabezado">
    ${params.logo?.startsWith('data:image/') ? `<img class="logo" src="${e(params.logo)}" alt="">` : ''}
    <h1>${e(params.tipoDocumento)}</h1>
    <p>Número: ${e(params.numero)}</p>
    <p>Fecha: ${e(params.fecha.toLocaleDateString('es-DO'))}</p>
    <p>Cliente: ${e(params.cliente)}</p>
  </div>
  <hr>
  ${lineasHtml}
  ${totalesHtml ? `<hr>${totalesHtml}` : ''}
  ${params.notas ? `<div class="notas">Notas: ${e(params.notas)}</div>` : ''}
  ${params.notaPie ? `<div class="nota-pie">${e(params.notaPie)}</div>` : ''}`;

  return `<!DOCTYPE html>
<html lang="es-DO">
<head>
<meta charset="utf-8">
<title>${e(params.tipoDocumento)}</title>
<style>
  @page { size: ${pageSize}; margin: ${margin}; }
  * { box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: ${fontSize}; margin: 0; padding: 0; width: 100%; }
  .encabezado { text-align: center; margin-bottom: 6px; }
  .encabezado h1 { font-size: 1.15em; margin: 0 0 4px; }
  .encabezado p { margin: 0; }
  hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  .linea { margin-bottom: 4px; }
  .concepto { word-break: break-word; }
  .fila-montos { display: flex; justify-content: space-between; gap: 8px; }
  .totales { margin-top: 6px; }
  .totales .total { font-weight: bold; }
  .notas { margin-top: 8px; }
  .nota-pie { margin-top: 8px; text-align: center; }
  .logo { max-width: 60%; max-height: 60px; margin-bottom: 4px; }
  .campo { margin: 0 0 4px; }
  .cliente p { margin: 0; }
</style>
</head>
<body>
  ${cuerpo}
  <script>window.onload = () => window.print();</script>
</body>
</html>`;
}

function renderBloqueTermico(
  bloque: BloqueTermico,
  params: DocumentoPdfParams,
  e: (v: string) => string,
  lineasHtml: string,
  totalesHtml: string,
): string {
  switch (bloque.tipo) {
    case 'logo':
      return params.logo?.startsWith('data:image/') ? `<div class="encabezado"><img class="logo" src="${e(params.logo)}" alt=""></div>` : '';

    case 'encabezado':
      return `<div class="encabezado">
        <h1>${e(params.tipoDocumento)}</h1>
        <p>Número: ${e(params.numero)}</p>
        <p>Fecha: ${e(params.fecha.toLocaleDateString('es-DO'))}</p>
      </div>`;

    case 'cliente': {
      const extra = datosClienteExtra(params);
      return `<div class="cliente">
        <p>Cliente: ${e(params.cliente)}</p>
        ${extra.map((linea) => `<p>${e(linea)}</p>`).join('')}
      </div>`;
    }

    case 'tabla_lineas':
      return lineasHtml ? `<hr>${lineasHtml}` : '';

    case 'totales':
      return totalesHtml ? `<hr>${totalesHtml}` : '';

    case 'campo': {
      if (!bloque.campo) return '';
      const valor = valorCampoDocumento(params, bloque.campo);
      if (!valor) return '';
      const prefijo = bloque.etiqueta ? `${e(bloque.etiqueta)} ` : '';
      return `<p class="campo">${prefijo}${e(valor)}</p>`;
    }

    case 'observaciones':
      return params.notas ? `<div class="notas">Notas: ${e(params.notas)}</div>` : '';

    case 'texto_legal':
      return params.notaPie ? `<div class="nota-pie">${e(params.notaPie)}</div>` : '';
  }
}
