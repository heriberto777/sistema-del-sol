import { CanalNotificacion } from '@prisma/client';

/**
 * Factura creada, Nota de Crédito/Débito creada y cotización enviada —
 * las notificaciones más básicas del sistema (avisarle al cliente que le
 * llegó un documento) no tenían ninguna plantilla por defecto, a
 * diferencia de Publicaciones Sociales/Comentarios de tarea/Vencimiento
 * de tareas (ver los otros `plantillas-*-base.ts`):
 * `NotificacionesService.enviar()` no manda nada hasta que exista una
 * `NotificacionPlantilla` activa para (tenantId, canal, clave), así que
 * sin esto el botón "Enviar" de una cotización (o crear una factura)
 * nunca mandaba el correo/WhatsApp y no había ningún aviso de que
 * faltaba configurar algo (bug real reportado — "le doy enviar y no
 * llega el correo").
 *
 * Se siembra en dos lugares (mismo criterio que las demás
 * `*_BASE`): acá mismo para tenants YA existentes (vía
 * `scripts/backfill-plantillas-ventas.ts`) y en
 * `TenantsRepository.crearConProvisioning` para tenants nuevos.
 */
export const PLANTILLAS_VENTAS_BASE: { canal: CanalNotificacion; clave: string; asunto?: string; cuerpo: string }[] = [
  {
    canal: 'EMAIL',
    clave: 'factura_creada',
    asunto: 'Tu factura por RD$ {{factura_total}}',
    cuerpo: 'Hola {{cliente_nombre}}, adjuntamos tu factura por <strong>RD$ {{factura_total}}</strong>. También podés verla acá: {{link}}',
  },
  {
    canal: 'WHATSAPP',
    clave: 'factura_creada',
    cuerpo: 'Hola {{cliente_nombre}}, tu factura por RD$ {{factura_total}} ya está lista: {{link}}',
  },
  {
    canal: 'EMAIL',
    clave: 'cotizacion_enviada',
    asunto: 'Cotización {{cotizacion_numero}}',
    cuerpo: 'Hola {{cliente_nombre}}, te enviamos la cotización <strong>{{cotizacion_numero}}</strong> por <strong>RD$ {{cotizacion_total}}</strong>. Podés verla acá: {{link}}',
  },
  {
    canal: 'WHATSAPP',
    clave: 'cotizacion_enviada',
    cuerpo: 'Hola {{cliente_nombre}}, te enviamos la cotización {{cotizacion_numero}} por RD$ {{cotizacion_total}}: {{link}}',
  },
  // Nota de Crédito/Débito comparte el modelo Factura y el evento
  // FACTURA_CREADA, pero con clave de plantilla propia — ver el
  // comentario en NotificacionesService.alFacturarse.
  {
    canal: 'EMAIL',
    clave: 'nota_credito_creada',
    asunto: 'Nota de crédito por RD$ {{factura_total}}',
    cuerpo: 'Hola {{cliente_nombre}}, te generamos una nota de crédito por <strong>RD$ {{factura_total}}</strong>. Podés verla acá: {{link}}',
  },
  {
    canal: 'WHATSAPP',
    clave: 'nota_credito_creada',
    cuerpo: 'Hola {{cliente_nombre}}, te generamos una nota de crédito por RD$ {{factura_total}}: {{link}}',
  },
  {
    canal: 'EMAIL',
    clave: 'nota_debito_creada',
    asunto: 'Nota de débito por RD$ {{factura_total}}',
    cuerpo: 'Hola {{cliente_nombre}}, te generamos una nota de débito por <strong>RD$ {{factura_total}}</strong>. Podés verla acá: {{link}}',
  },
  {
    canal: 'WHATSAPP',
    clave: 'nota_debito_creada',
    cuerpo: 'Hola {{cliente_nombre}}, te generamos una nota de débito por RD$ {{factura_total}}: {{link}}',
  },
  // CRM "Cotización conectada" — a diferencia de todo lo de arriba (avisos
  // AL CLIENTE), estas dos van al VENDEDOR cuando el cliente responde
  // desde el link público (DocumentosPublicosService.responderCotizacion)
  // — solo EMAIL, no tiene sentido un WhatsApp interno de "aviso al
  // equipo" todavía.
  {
    canal: 'EMAIL',
    clave: 'cotizacion_aprobada_vendedor',
    asunto: '{{cliente_nombre}} aprobó la cotización {{cotizacion_numero}}',
    cuerpo:
      'Hola, {{cliente_nombre}} aprobó la cotización <strong>{{cotizacion_numero}}</strong>. Revisala y convertila en factura cuando confirmes stock y precio.',
  },
  {
    canal: 'EMAIL',
    clave: 'cotizacion_rechazada_vendedor',
    asunto: '{{cliente_nombre}} rechazó la cotización {{cotizacion_numero}}',
    cuerpo: 'Hola, {{cliente_nombre}} rechazó la cotización <strong>{{cotizacion_numero}}</strong>{{motivo}}',
  },
  // "Enviar recibo" (botón manual en Imprimir) y el recordatorio de cobro
  // (cron diario) usaban claves ("factura_recibo"/"factura_vencida") que
  // nunca estuvieron en este archivo ni en el catálogo de eventos — nunca
  // hubo una plantilla activa para ninguna, en ningún tenant, así que
  // ambos envíos fallaban siempre en silencio (bug real reportado: "No
  // hay una plantilla de notificación activa para este canal").
  {
    canal: 'EMAIL',
    clave: 'factura_recibo',
    asunto: 'Tu factura {{factura_ncf}} por RD$ {{factura_total}}',
    cuerpo: 'Hola {{cliente_nombre}}, adjuntamos tu factura <strong>{{factura_ncf}}</strong> del {{factura_fecha}} por <strong>RD$ {{factura_total}}</strong>. También podés verla acá: {{link}}',
  },
  {
    canal: 'WHATSAPP',
    clave: 'factura_recibo',
    cuerpo: 'Hola {{cliente_nombre}}, tu factura {{factura_ncf}} del {{factura_fecha}} por RD$ {{factura_total}} está lista: {{link}}',
  },
  {
    canal: 'EMAIL',
    clave: 'factura_vencida',
    asunto: 'Factura {{factura_ncf}} vencida',
    cuerpo: 'Hola {{cliente_nombre}}, tu factura <strong>{{factura_ncf}}</strong> por <strong>RD$ {{factura_total}}</strong> ya venció. Por favor regularizá el pago a la brevedad.',
  },
  {
    canal: 'WHATSAPP',
    clave: 'factura_vencida',
    cuerpo: 'Hola {{cliente_nombre}}, tu factura {{factura_ncf}} por RD$ {{factura_total}} ya venció. Por favor regularizá el pago a la brevedad.',
  },
];
