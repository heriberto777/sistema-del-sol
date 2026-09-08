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
  /** Texto libre — mutuamente excluyente con `contentSid` (Twilio rechaza mandar ambos). */
  body?: string;
  /** URL pública HTTPS de una imagen — Twilio la descarga él mismo, no acepta el base64 inline (ver ProductoImagenPublicaController). */
  mediaUrl?: string;
  /**
   * Fase 5 (Publicaciones Sociales) — Content SID de una plantilla YA
   * aprobada por Meta (Twilio Content API). Es la única forma de que el
   * NEGOCIO inicie una conversación de WhatsApp fuera de la ventana de
   * sesión de 24hs — un `body` libre lo rechaza Twilio en ese caso.
   */
  contentSid?: string;
  /** Variables de la plantilla (ej. `{"1": "Yogurt Fresa", "2": "https://..."}`) — Twilio espera el objeto serializado como string JSON. */
  contentVariables?: Record<string, string>;
}): Promise<boolean> {
  const form: Record<string, string> = {
    From: params.from,
    To: `whatsapp:${params.to}`,
  };
  if (params.contentSid) {
    form.ContentSid = params.contentSid;
    if (params.contentVariables) form.ContentVariables = JSON.stringify(params.contentVariables);
  } else {
    form.Body = params.body ?? '';
  }
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
