import JsBarcode from 'jsbarcode';
import { abrirBlob, descargarBlob } from './descargar-archivo';

export interface EtiquetaCodigoBarras {
  codigoBarras: string;
  nombreProducto: string;
  variante?: string;
}

/**
 * Duplicada del backend (`generador-codigo-barras.util.ts`) — mismo
 * criterio de duplicación entre capas ya usado en este proyecto para
 * funciones puras chicas. Un código generado por el botón "Generar" con
 * formato EAN-13, o un código real de fábrica que ya sea EAN-13, se
 * imprime con esa simbología en vez de Code128 — cualquier lector de
 * punto de venta lo reconoce sin configuración especial.
 */
function calcularDigitoVerificadorEan13(doce: string): number {
  let suma = 0;
  for (let i = 0; i < 12; i++) {
    suma += Number(doce[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (suma % 10)) % 10;
}

export function esEan13Valido(codigo: string): boolean {
  if (!/^\d{13}$/.test(codigo)) return false;
  return calcularDigitoVerificadorEan13(codigo.slice(0, 12)) === Number(codigo[12]);
}

/** EAN-13 si el código lo es de verdad (generado o real de fábrica); Code128 en cualquier otro caso — sigue soportando cualquier valor alfanumérico como antes. */
export function detectarFormato(codigo: string): 'EAN13' | 'CODE128' {
  return esEan13Valido(codigo) ? 'EAN13' : 'CODE128';
}

function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Renderiza cada código a un <svg> desprendido del DOM (JsBarcode no
 * necesita que esté insertado para dibujar) y devuelve su markup ya
 * serializado — sin tocar el documento actual.
 */
function renderizarBarcodeSvg(codigo: string): string {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  JsBarcode(svg, codigo, { format: detectarFormato(codigo), displayValue: true, width: 1.6, height: 40, fontSize: 11, margin: 4 });
  return svg.outerHTML;
}

/**
 * Hoja de etiquetas para imprimir — mismo criterio que
 * `documento-ticket.ts` del backend (documento HTML standalone con
 * `window.print()`, sin ESC/POS crudo ni agente local), pero 100%
 * client-side porque JsBarcode solo corre en el navegador.
 */
export function generarHtmlEtiquetas(etiquetas: EtiquetaCodigoBarras[]): string {
  const e = escaparHtml;
  const etiquetasHtml = etiquetas
    .map(
      (et) => `<div class="etiqueta">
        <div class="nombre">${e(et.nombreProducto)}</div>
        ${et.variante ? `<div class="variante">${e(et.variante)}</div>` : ''}
        ${renderizarBarcodeSvg(et.codigoBarras)}
      </div>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="es-DO">
<head>
<meta charset="utf-8">
<title>Etiquetas</title>
<style>
  @page { size: auto; margin: 8mm; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; margin: 0; padding: 0; }
  .hoja { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
  .etiqueta { border: 1px dashed #999; border-radius: 4px; padding: 3mm; text-align: center; break-inside: avoid; }
  .nombre { font-size: 10px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .variante { font-size: 9px; color: #555; margin-bottom: 2px; }
  svg { max-width: 100%; }
</style>
</head>
<body>
  <div class="hoja">${etiquetasHtml}</div>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;
}

export function imprimirEtiquetas(etiquetas: EtiquetaCodigoBarras[]) {
  const html = generarHtmlEtiquetas(etiquetas);
  abrirBlob(new Blob([html], { type: 'text/html' }));
}

/**
 * Impresora de etiquetas ZPL/EPL (plan de integración Cuadre, ítem
 * J-1) — mismo criterio que la impresión térmica del backend
 * (`documento-ticket.ts`, ver ARCHITECTURE.md): generamos el archivo de
 * comandos y lo descargamos, sin agente local ni driver propio — el
 * usuario lo manda a su impresora de etiquetas (Zebra/Eltron) con el
 * método que ya tenga configurado (spooler "Generic/Text Only", `copy
 * /b archivo.zpl LPT1`, envío directo al puerto 9100, etc.), igual
 * filosofía que F-9 (impresión ESC/POS) — fuera de alcance construir
 * ese agente.
 */
function escaparZpl(valor: string): string {
  // ^ y ~ son caracteres de control ZPL (inician comandos) — un valor que
  // los contenga rompería el comando siguiente si no se los quita.
  return valor.replace(/[\^~]/g, '');
}

/**
 * `^BC` (Code128) vs `^BE` (EAN-13) — comandos ZPL II reales según la
 * referencia de Zebra, pero **sin poder verificar contra una impresora
 * térmica física en este entorno** (mismo criterio ya aceptado para el
 * resto de esta feature: mejor esfuerzo documentado, no probado contra
 * hardware). `^BE` espera 12 dígitos de dato (la impresora calcula el
 * 13vo dígito verificador sola) — por eso se recorta `codigoBarras` a
 * los primeros 12 dígitos cuando el formato es EAN-13.
 */
function comandoBarcodeZpl(codigo: string): string {
  if (detectarFormato(codigo) === 'EAN13') {
    return `^BEN,70,Y,N\n^FD${codigo.slice(0, 12)}^FS`;
  }
  return `^BCN,70,Y,N,N\n^FD${escaparZpl(codigo)}^FS`;
}

export function generarZplEtiquetas(etiquetas: EtiquetaCodigoBarras[]): string {
  return etiquetas
    .map(
      (et) => `^XA
^FO20,20^A0N,26,26^FD${escaparZpl(et.nombreProducto)}^FS
${et.variante ? `^FO20,52^A0N,20,20^FD${escaparZpl(et.variante)}^FS\n` : ''}^FO20,80^BY2
${comandoBarcodeZpl(et.codigoBarras)}
^XZ`,
    )
    .join('\n');
}

function escaparEpl(valor: string): string {
  // Las comillas dobles cierran el campo de texto EPL antes de tiempo.
  return valor.replace(/"/g, "'");
}

/**
 * Selector de tipo de barra del comando `B` de EPL2 — la sintaxis
 * preexistente ya usaba `1` para el código de barras (documentado como
 * Code128 en el comentario original, sin tocar acá). Para EAN-13 el tipo
 * documentado en el manual de programación EPL2 de Eltron/Zebra es `C`
 * — igual que el resto de esta feature, **sin poder verificar contra una
 * impresora térmica física en este entorno**, mejor esfuerzo documentado.
 */
function tipoBarraEpl(codigo: string): string {
  return detectarFormato(codigo) === 'EAN13' ? 'C' : '1';
}

export function generarEplEtiquetas(etiquetas: EtiquetaCodigoBarras[]): string {
  return etiquetas
    .map(
      (et) => `N
A20,20,0,3,1,1,N,"${escaparEpl(et.nombreProducto)}"
${et.variante ? `A20,50,0,2,1,1,N,"${escaparEpl(et.variante)}"\n` : ''}B20,80,0,${tipoBarraEpl(et.codigoBarras)},2,2,70,N,"${escaparEpl(et.codigoBarras)}"
P1`,
    )
    .join('\n');
}

export function descargarZplEtiquetas(etiquetas: EtiquetaCodigoBarras[]) {
  descargarBlob(new Blob([generarZplEtiquetas(etiquetas)], { type: 'text/plain' }), 'etiquetas.zpl');
}

export function descargarEplEtiquetas(etiquetas: EtiquetaCodigoBarras[]) {
  descargarBlob(new Blob([generarEplEtiquetas(etiquetas)], { type: 'text/plain' }), 'etiquetas.epl');
}
