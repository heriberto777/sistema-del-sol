import * as QRCode from 'qrcode';

/**
 * Genera un QR como data URI PNG a partir de un texto/URL — usado por
 * "Formato de Documentos" Fase B1 (QR genérico de link de pago o texto
 * libre). Nunca lanza: ante cualquier error de la librería, devuelve
 * `undefined` y quien llama simplemente no dibuja el bloque de QR, igual
 * que `insertarLogo` en `documento-pdf.ts` ante un logo corrupto.
 *
 * Deliberadamente NO sabe nada de e-CF/DGII — ese QR (Fase B2) requiere
 * datos reales de la firma digital que el sistema todavía no captura
 * (ver EmisionECfService/AlanubeAdapter); mezclar esa lógica acá
 * invitaría a "completar" el QR oficial con datos inventados.
 */
export async function generarQrDataUri(contenido: string): Promise<string | undefined> {
  try {
    return await QRCode.toDataURL(contenido, { margin: 1, width: 200 });
  } catch {
    return undefined;
  }
}
