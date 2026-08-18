import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verificación de firma de webhook de Stripe hand-rolled (HMAC-SHA256
 * sobre `${timestamp}.${body}`) — mismo criterio de `crypto` nativo que
 * ya usa password-reset-token.ts, no justifica el SDK oficial para esto.
 * Esquema documentado públicamente por Stripe, sin necesidad del SDK.
 */
export function verificarFirmaStripe(
  payload: Buffer,
  header: string | undefined,
  secret: string,
  toleranciaSegundos = 300,
): boolean {
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
