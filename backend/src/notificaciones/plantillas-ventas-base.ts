import { CanalNotificacion } from '@prisma/client';

/**
 * Factura creada y cotización enviada — las dos notificaciones más
 * básicas del sistema (avisarle al cliente que le llegó un documento) no
 * tenían ninguna plantilla por defecto, a diferencia de Publicaciones
 * Sociales/Comentarios de tarea/Vencimiento de tareas (ver los otros
 * `plantillas-*-base.ts`): `NotificacionesService.enviar()` no manda nada
 * hasta que exista una `NotificacionPlantilla` activa para
 * (tenantId, canal, clave), así que sin esto el botón "Enviar" de una
 * cotización (o crear una factura) nunca mandaba el correo/WhatsApp y no
 * había ningún aviso de que faltaba configurar algo (bug real reportado
 * — "le doy enviar y no llega el correo").
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
];
