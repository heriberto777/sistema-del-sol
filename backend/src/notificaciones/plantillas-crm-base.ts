import { CanalNotificacion } from '@prisma/client';

/**
 * Aviso de "hoy vence" para actividades del CRM (Fase 3) — mismo motivo
 * que `plantillas-vencimiento-tareas-base.ts`: sin contenido por defecto,
 * `NotificacionesService.enviar()` no manda nada hasta que un admin cree
 * la plantilla a mano (bug real ya encontrado una vez con Ventas/Alertas
 * Operativas, ver commit 14ec64b — no repetirlo acá).
 *
 * Se siembra en dos lugares (mismo criterio que
 * PLANTILLAS_VENCIMIENTO_TAREAS_BASE): acá mismo (tenants YA existentes,
 * vía `scripts/backfill-plantillas-crm.ts`) y en
 * `TenantsRepository.crearConProvisioning` (tenants nuevos).
 */
export const PLANTILLAS_CRM_BASE: { canal: CanalNotificacion; clave: string; asunto?: string; cuerpo: string }[] = [
  {
    canal: 'EMAIL',
    clave: 'crm_actividad_vence_hoy',
    asunto: 'Hoy vence tu actividad del CRM',
    cuerpo: 'Tenías programada para hoy: <strong>{{actividad_descripcion}}</strong>.',
  },
  {
    canal: 'WHATSAPP',
    clave: 'crm_actividad_vence_hoy',
    cuerpo: 'Hoy vence tu actividad del CRM: "{{actividad_descripcion}}"',
  },
];
