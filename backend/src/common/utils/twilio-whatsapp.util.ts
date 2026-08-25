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
}): Promise<boolean> {
  const respuesta = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${params.accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${params.accountSid}:${params.authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      From: params.from,
      To: `whatsapp:${params.to}`,
      Body: params.body,
    }),
  });

  return respuesta.ok;
}
