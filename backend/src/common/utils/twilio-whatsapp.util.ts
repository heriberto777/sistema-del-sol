/**
 * POST crudo a la API de WhatsApp de Twilio (Basic Auth + form-urlencoded,
 * sin el SDK oficial — mismo criterio que el resto del proyecto con
 * proveedores externos). Extraído de `WhatsAppChannel.enviar()` para que
 * el bot de WhatsApp (ítem H-2b) lo reuse con las credenciales
 * descifradas del TENANT, en vez de duplicar esta llamada.
 */
export async function enviarWhatsappTwilio(params: {
  accountSid: string;
  authToken: string;
  from: string;
  to: string;
  body: string;
  /** URL pública HTTPS de una imagen — Twilio la descarga él mismo, no acepta el base64 inline (ver ProductoImagenPublicaController). */
  mediaUrl?: string;
}): Promise<boolean> {
  const form: Record<string, string> = {
    From: params.from,
    To: `whatsapp:${params.to}`,
    Body: params.body,
  };
  if (params.mediaUrl) form.MediaUrl = params.mediaUrl;

  const respuesta = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${params.accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${params.accountSid}:${params.authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(form),
  });

  return respuesta.ok;
}
