import { CanalNotificacion } from '@prisma/client';

/**
 * Aviso de "hoy vence" para Mis Tareas y tareas de Proyectos — contenido
 * REAL por defecto, mismo motivo que `plantillas-comentarios-tarea-base.ts`:
 * sin esto, `NotificacionesService.enviar()` no manda nada hasta que un
 * admin cree la plantilla a mano. WHATSAPP usa el canal compartido de
 * Plataforma (mismo criterio que el resto); sin `User.telefono` cargado,
 * ese canal simplemente no se manda.
 *
 * Se siembra en dos lugares (mismo criterio que
 * PLANTILLAS_COMENTARIOS_TAREA_BASE): acá mismo (tenants YA existentes,
 * vía `scripts/backfill-plantillas-vencimiento-tareas.ts`) y en
 * `TenantsRepository.crearConProvisioning` (tenants nuevos).
 */
export const PLANTILLAS_VENCIMIENTO_TAREAS_BASE: { canal: CanalNotificacion; clave: string; asunto?: string; cuerpo: string }[] = [
  {
    canal: 'EMAIL',
    clave: 'tarea_personal_vence_hoy',
    asunto: 'Hoy vence tu tarea: "{{tarea_titulo}}"',
    cuerpo: 'Tu tarea <strong>{{tarea_titulo}}</strong> tiene fecha para hoy.',
  },
  {
    canal: 'WHATSAPP',
    clave: 'tarea_personal_vence_hoy',
    cuerpo: 'Hoy vence tu tarea: "{{tarea_titulo}}"',
  },
  {
    canal: 'EMAIL',
    clave: 'tarea_proyecto_vence_hoy',
    asunto: 'Hoy vence la tarea "{{tarea_titulo}}" — {{proyecto_nombre}}',
    cuerpo: 'La tarea <strong>{{tarea_titulo}}</strong> del proyecto <strong>{{proyecto_nombre}}</strong> tiene fecha de vencimiento para hoy.',
  },
  {
    canal: 'WHATSAPP',
    clave: 'tarea_proyecto_vence_hoy',
    cuerpo: 'Hoy vence "{{tarea_titulo}}" ({{proyecto_nombre}})',
  },
];
