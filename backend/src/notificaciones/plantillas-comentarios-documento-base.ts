import { CanalNotificacion } from '@prisma/client';

/**
 * Fase 11.2 del benchmark (Alegra pega comentarios/recordatorios,
 * mencionar con @, a Factura/Cotización) — contenido REAL por defecto,
 * mismo motivo que `PLANTILLAS_COMENTARIOS_TAREA_BASE`: sin esto,
 * `NotificacionesService.enviar()` no manda nada hasta que un admin cree
 * la plantilla a mano. Mismo canal WHATSAPP compartido de Plataforma que
 * esa (texto simple, no Content API por tenant) — sin `User.telefono`
 * cargado, el email sigue siendo el mínimo.
 *
 * Dos claves: una para cuando te mencionan en un comentario nuevo, otra
 * para cuando llega la fecha de un recordatorio (`comentario_documento_
 * recordatorio`, disparada por el cron de `RecordatoriosService`, no por
 * un evento — mismo criterio que `factura_vencida`, la clave que ya usa
 * ese mismo cron para avisar de facturas de crédito vencidas).
 *
 * Se siembra en dos lugares (mismo criterio que las demás
 * `PLANTILLAS_*_BASE`): acá mismo (tenants YA existentes, vía
 * `scripts/backfill-plantillas-comentarios-documento.ts`) y en
 * `TenantsRepository.crearConProvisioning`/reprovisionar (tenants
 * nuevos).
 */
export const PLANTILLAS_COMENTARIOS_DOCUMENTO_BASE: { canal: CanalNotificacion; clave: string; asunto?: string; cuerpo: string }[] = [
  {
    canal: 'EMAIL',
    clave: 'comentario_documento_mencion',
    asunto: 'Te mencionaron en un comentario de {{tipo_documento_etiqueta}} {{documento_etiqueta}}',
    cuerpo:
      '<strong>{{autor_nombre}}</strong> te mencionó en un comentario de la {{tipo_documento_etiqueta}} <strong>{{documento_etiqueta}}</strong>:<br><br>' +
      '"{{texto}}"',
  },
  {
    canal: 'WHATSAPP',
    clave: 'comentario_documento_mencion',
    cuerpo: '{{autor_nombre}} te mencionó en un comentario de {{tipo_documento_etiqueta}} {{documento_etiqueta}}: "{{texto}}"',
  },
  {
    canal: 'EMAIL',
    clave: 'comentario_documento_recordatorio',
    asunto: 'Recordatorio — {{tipo_documento_etiqueta}} {{documento_etiqueta}}',
    cuerpo:
      'Tenías un recordatorio para hoy en la {{tipo_documento_etiqueta}} <strong>{{documento_etiqueta}}</strong>:<br><br>' +
      '"{{texto}}"',
  },
  {
    canal: 'WHATSAPP',
    clave: 'comentario_documento_recordatorio',
    cuerpo: 'Recordatorio de hoy en {{tipo_documento_etiqueta}} {{documento_etiqueta}}: "{{texto}}"',
  },
];
