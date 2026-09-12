import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verificación de firma de webhook de Duffel — mismo esquema que Stripe
 * (confirmado contra la doc pública de Duffel: header `X-Duffel-Signature`
 * con formato `t=<timestamp>,v1=<firma>`, HMAC-SHA256 sobre
 * `${timestamp}.${body}`), así que la lógica es una copia deliberada de
 * `verificarFirmaStripe` en vez de compartirla entre módulos — mismo
 * criterio de un archivo por proveedor que ya sigue el resto del repo
 * (StripeAdapter/AlanubeAdapter/DuffelAdapter no comparten código entre sí).
 */
export function verificarFirmaDuffel(payload: Buffer, header: string | undefined, secret: string, toleranciaSegundos = 300): boolean {
  if (!header) return false;

  const partes = Object.fromEntries(
    header.split(',').map((parte) => {
      const [clave, valor] = parte.split('=');
      return [clave, valor];
    }),
  );
  const timestamp = partes['t'];
  const firma = partes['v1'];
  if (!timestamp || !firma) return false;

  const antiguedadSegundos = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(antiguedadSegundos) || antiguedadSegundos > toleranciaSegundos) return false;

  const payloadFirmado = `${timestamp}.${payload.toString('utf8')}`;
  const esperada = createHmac('sha256', secret).update(payloadFirmado).digest('hex');

  const bufferEsperada = Buffer.from(esperada, 'hex');
  const bufferFirma = Buffer.from(firma, 'hex');
  if (bufferEsperada.length !== bufferFirma.length) return false;

  return timingSafeEqual(bufferEsperada, bufferFirma);
}
