import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Envelope real de un webhook de Duffel — la doc pública confirma el
 * esquema de firma (ver verificarFirmaDuffel) y los nombres de evento,
 * pero NO se pudo confirmar en vivo la forma exacta del envelope (no hay
 * forma de recibir un webhook real sin una URL pública desde este
 * entorno de desarrollo). Se acepta un cuerpo laxo, con varias rutas
 * posibles para encontrar el id de la orden.
 */
export interface DuffelWebhookEvento {
  type?: string;
  object_id?: string;
  data?: {
    id?: string;
    order_id?: string;
    object?: { id?: string; order_id?: string };
    [key: string]: unknown;
  };
}

/**
 * Cada tenant tiene su PROPIA cuenta de Duffel — el controller necesita
 * saber a qué tenant pertenece un webhook ANTES de poder verificar su
 * firma (el secreto es por tenant). Esta función es pura (sin acceso a
 * BD/secretos) justamente para poder correr sobre el body SIN verificar
 * todavía — resolver el tenant por un dato público del evento nunca es un
 * problema de seguridad (mismo criterio que WhatsappWebhookController
 * resolviendo por el número `To` antes de validar la firma de Twilio): la
 * firma sigue siendo la única puerta para que el evento tenga efecto.
 */
export function extraerIdOrdenDuffel(evento: DuffelWebhookEvento): string | undefined {
  return evento.data?.order_id ?? evento.data?.object?.order_id ?? evento.object_id ?? evento.data?.id ?? evento.data?.object?.id;
}

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
