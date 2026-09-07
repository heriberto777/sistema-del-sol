/**
 * Generación de códigos de barra internos (bajo demanda, botón "Generar"
 * en `VariantesProductoPanel.tsx`) — nunca se genera solo, nunca pisa un
 * código ya cargado sin que el usuario lo pida explícitamente.
 */

/** Algoritmo estándar EAN-13: dígitos en posición impar (índice par 0-based) peso 1, posición par (índice impar) peso 3; dígito verificador = (10 - suma%10) % 10. */
export function calcularDigitoVerificadorEan13(doce: string): number {
  let suma = 0;
  for (let i = 0; i < 12; i++) {
    suma += Number(doce[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (suma % 10)) % 10;
}

/**
 * Prefijo "20" — reservado por GS1 para uso interno/en tienda (todo el
 * rango 200-299 está fuera de la asignación normal de fabricantes), así
 * que un código generado acá nunca choca con un código real de fábrica
 * que el usuario cargue después a mano. + 10 dígitos secuenciales
 * (correlativo atómico, `TipoCorrelativo.CODIGO_BARRAS`) + 1 dígito
 * verificador = 13 dígitos totales.
 */
export function generarEan13Interno(secuencial: number): string {
  const cuerpo = '20' + String(secuencial).padStart(10, '0');
  return cuerpo + calcularDigitoVerificadorEan13(cuerpo);
}

/**
 * Code128 interno — sin dígito verificador "humano" (Code128 ya tiene su
 * propio checksum de símbolo, invisible para el lector); prefijo "INT"
 * para que sea obvio a simple vista que no es un código de fabricante.
 */
export function generarCode128Interno(secuencial: number): string {
  return 'INT' + String(secuencial).padStart(10, '0');
}

/**
 * true si `codigo` es un EAN-13 sintácticamente válido (13 dígitos +
 * dígito verificador correcto). Usado también por el frontend
 * (`etiquetas-codigo-barras.ts`, versión duplicada — mismo criterio de
 * duplicación entre capas ya usado en este proyecto para funciones puras
 * chicas) para elegir el formato de impresión de una etiqueta.
 */
export function esEan13Valido(codigo: string): boolean {
  if (!/^\d{13}$/.test(codigo)) return false;
  return calcularDigitoVerificadorEan13(codigo.slice(0, 12)) === Number(codigo[12]);
}
