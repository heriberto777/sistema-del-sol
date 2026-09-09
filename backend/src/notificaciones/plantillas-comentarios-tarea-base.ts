import { CanalNotificacion } from '@prisma/client';

/**
 * Fase 8 (Comentarios de tarea) — contenido REAL por defecto, mismo motivo
 * que `plantillas-publicaciones-sociales-base.ts`: sin esto,
 * `NotificacionesService.enviar()` no manda nada hasta que un admin cree
 * la plantilla a mano.
 *
 * WHATSAPP acá usa el canal COMPARTIDO de Plataforma (mismo camino que
 * `factura_creada`/`cotizacion_enviada` a clientes vía `WhatsAppChannel`,
 * credenciales `TWILIO_*` de plataforma) — no el camino de Content API
 * por tenant que usa Publicaciones Sociales para aprobadores (ese exige
 * una plantilla ya aprobada por Meta, pensado para mensajes con botones,
 * excesivo para un aviso de texto simple). Sin `User.telefono` cargado,
 * simplemente no se manda ese canal — el email siempre es el mínimo.
 *
 * Se siembra en dos lugares (mismo criterio que
 * PLANTILLAS_PUBLICACIONES_SOCIALES_BASE): acá mismo (tenants YA
 * existentes, vía `scripts/backfill-plantillas-comentarios-tarea.ts`) y
 * en `TenantsRepository.crearConProvisioning` (tenants nuevos).
 */
export const PLANTILLAS_COMENTARIOS_TAREA_BASE: { canal: CanalNotificacion; clave: string; asunto?: string; cuerpo: string }[] = [
  {
    canal: 'EMAIL',
    clave: 'tarea_proyecto_comentario_nuevo',
    asunto: 'Nuevo comentario en "{{tarea_titulo}}"',
    cuerpo:
      '<strong>{{autor_nombre}}</strong> comentó en la tarea <strong>{{tarea_titulo}}</strong> del proyecto <strong>{{proyecto_nombre}}</strong>:<br><br>' +
      '"{{contenido}}"',
  },
  {
    canal: 'WHATSAPP',
    clave: 'tarea_proyecto_comentario_nuevo',
    cuerpo: '{{autor_nombre}} comentó en "{{tarea_titulo}}" ({{proyecto_nombre}}): "{{contenido}}"',
  },
];
