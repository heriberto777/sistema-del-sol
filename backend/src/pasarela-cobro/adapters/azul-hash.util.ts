import { createHmac, timingSafeEqual } from 'crypto';

/**
 * HMAC-SHA512 de AZUL "Página de Pagos" — sin SDK oficial (AZUL no publica
 * uno para Node.js), mismo criterio que verificarFirmaStripe. Tomado
 * textual del documento oficial "Documento-E-Commerce-AZUL-Pagina-Pagos",
 * sección "Manejo de la Autenticación (AuthHash)": clave = AuthKey (bytes
 * UTF-8), mensaje = concatenación de campos + AuthKey al final, codificado
 * UTF-16LE — el AuthKey va DOS veces (al final del mensaje Y como clave
 * del HMAC), así lo define el ejemplo oficial en PHP/C#.
 */
export function calcularHashAzul(campos: string[], authKey: string): string {
  const mensaje = campos.join('') + authKey;
  return createHmac('sha512', Buffer.from(authKey, 'utf8'))
    .update(Buffer.from(mensaje, 'utf16le'))
    .digest('hex');
}

export function compararHashesAzul(esperado: string, recibido: string): boolean {
  const bufEsperado = Buffer.from(esperado, 'hex');
  const bufRecibido = Buffer.from(recibido, 'hex');
  if (bufEsperado.length !== bufRecibido.length || bufEsperado.length === 0) return false;
  return timingSafeEqual(bufEsperado, bufRecibido);
}

/** "Se envía sin coma ni punto; los dos últimos dígitos representan los decimales" — ej. 1000 = 10.00. */
export function formatearMontoAzul(monto: number): string {
  return Math.round(monto * 100).toString();
}
