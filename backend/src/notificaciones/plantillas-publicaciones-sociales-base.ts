import { CanalNotificacion } from '@prisma/client';

/**
 * Fase 5 (Publicaciones Sociales) — contenido REAL por defecto, no en
 * blanco: sin esto, `NotificacionesService.enviar()` no manda nada (solo
 * loguea un warning) hasta que un admin cree la plantilla a mano, y el
 * usuario pidió explícitamente que no dependiera de eso.
 *
 * Solo canal EMAIL — el aviso de WhatsApp a los aprobadores usa Content
 * API de Twilio directo (`NotificacionesService.enviarWhatsappAprobacionTenant`),
 * no pasa por `NotificacionPlantilla`.
 *
 * Se siembra en dos lugares (mismo criterio que ROLES_BASE, ver
 * roles-base.ts): acá mismo (para tenants YA existentes, vía
 * `scripts/backfill-plantillas-publicaciones-sociales.ts`) y en
 * `TenantsRepository.crearConProvisioning` (para tenants nuevos).
 */
export const PLANTILLAS_PUBLICACIONES_SOCIALES_BASE: { canal: CanalNotificacion; clave: string; asunto: string; cuerpo: string }[] = [
  {
    canal: 'EMAIL',
    clave: 'publicacion_social_pendiente_aprobacion',
    asunto: 'Tenés un diseño pendiente de aprobar — {{producto_nombre}}',
    cuerpo:
      'Hay un nuevo diseño de <strong>{{producto_nombre}}</strong> esperando tu aprobación.<br><br>' +
      '<a href="{{link}}">Ver el diseño</a>',
  },
  {
    canal: 'EMAIL',
    clave: 'publicacion_social_cambios_solicitados',
    asunto: 'Te pidieron cambios en el diseño de {{producto_nombre}}',
    cuerpo:
      'El aprobador pidió lo siguiente sobre el diseño de <strong>{{producto_nombre}}</strong>:<br><br>' +
      '"{{comentario}}"<br><br>' +
      '<a href="{{link}}">Editar y regenerar</a>',
  },
  {
    canal: 'EMAIL',
    clave: 'publicacion_social_aprobada',
    asunto: 'Tu diseño de {{producto_nombre}} fue aprobado',
    cuerpo:
      'El diseño de <strong>{{producto_nombre}}</strong> fue aprobado — ya se puede descargar o enviar por WhatsApp.<br><br>' +
      '<a href="{{link}}">Verlo</a>',
  },
  {
    canal: 'EMAIL',
    clave: 'publicacion_social_rechazada',
    asunto: 'Tu diseño de {{producto_nombre}} fue rechazado',
    cuerpo: 'El diseño de <strong>{{producto_nombre}}</strong> fue rechazado.<br><br>Motivo: "{{motivo_rechazo}}"',
  },
];
