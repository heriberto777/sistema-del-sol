/**
 * Genera el TXT delimitado por "|" con fechas en AAAAMMDD, que es el
 * formato general que usa la DGII para 606/607/608 — pero el layout
 * EXACTO (orden de columnas, códigos de tipo de bien/servicio, tipo de
 * ingreso, tipo de anulación) no pudo verificarse byte a byte contra la
 * especificación oficial (los PDF instructivos de la DGII no son
 * extraíbles como texto). **Antes de remitir esto a la Oficina Virtual,
 * hay que validarlo con la herramienta de pre-validación oficial de la
 * DGII** — ver ARCHITECTURE.md, sección "Reportes fiscales DGII".
 */
export function generarTxtFiscal(filas: string[][]): string {
  return filas.map((fila) => fila.join('|')).join('\r\n');
}

export function formatoFechaDgii(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export function formatoMontoDgii(monto: number): string {
  return monto.toFixed(2);
}
