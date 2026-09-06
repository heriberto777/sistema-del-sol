/**
 * Deriva `https://tu-dominio` a partir de `WHATSAPP_WEBHOOK_URL` (ya
 * obligatoria para que el bot funcione — ver `.env.sample`) en vez de
 * agregar una variable de entorno nueva solo para esto. Se usa para armar
 * la URL absoluta del endpoint público de imagen de producto que Twilio
 * necesita poder descargar (`MediaUrl`, ver `twilio-whatsapp.util.ts`).
 * `null` si la variable no está configurada — el caller decide no mandar
 * imagen en ese caso, nunca lanza.
 */
export function resolverOrigenPublicoWhatsapp(): string | null {
  const url = process.env.WHATSAPP_WEBHOOK_URL;
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
