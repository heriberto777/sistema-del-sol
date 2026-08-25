import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verificación de `X-Twilio-Signature` — HMAC-SHA1 (crypto nativo, sin
 * SDK — mismo criterio que `azul-hash.util.ts`/`stripe-webhook.util.ts`).
 * Algoritmo documentado por Twilio: concatenar la URL completa del
 * webhook (tal cual está configurada en su consola) con cada parámetro
 * POST, ordenados alfabéticamente por nombre de clave, clave+valor
 * pegados sin separador; HMAC-SHA1 con el AuthToken como clave; base64;
 * comparar con el header (`timingSafeEqual`).
 *
 * Como todos los tenants apuntan a la MISMA URL de webhook (se resuelve
 * el tenant por el campo `To`, no por la URL), la verificación ocurre
 * DESPUÉS de resolver qué tenant es — recién ahí se sabe con qué
 * `authToken` comparar. Sigue siendo seguro: una firma válida solo se
 * puede producir con el `authToken` real de ESE tenant.
 */
export function verificarFirmaTwilio(urlCompleta: string, params: Record<string, string>, firma: string | undefined, authToken: string): boolean {
  if (!firma) return false;

  const mensaje =
    urlCompleta +
    Object.keys(params)
      .sort()
      .map((clave) => clave + params[clave])
      .join('');

  const esperada = createHmac('sha1', authToken).update(mensaje, 'utf8').digest('base64');

  const bufEsperada = Buffer.from(esperada);
  const bufRecibida = Buffer.from(firma);
  if (bufEsperada.length !== bufRecibida.length) return false;
  return timingSafeEqual(bufEsperada, bufRecibida);
}
