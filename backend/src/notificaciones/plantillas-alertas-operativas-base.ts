import { CanalNotificacion } from '@prisma/client';

/**
 * Avisos operativos internos (stock bajo, NCF por agotarse, lote por
 * vencer, bot de WhatsApp que necesita un humano, hito/presupuesto de
 * Proyectos) — mismo problema que `plantillas-ventas-base.ts`: ninguna
 * tenía plantilla por defecto, así que `NotificacionesService.enviar()`
 * nunca mandaba nada hasta que un admin la creara a mano desde
 * Configuración, sin ningún aviso de que faltaba. Todas van solo por
 * EMAIL (a Admin Total/Almacenero/responsable de proyecto, nunca al
 * cliente final).
 *
 * Se siembra en dos lugares (mismo criterio que las demás `*_BASE`): acá
 * mismo para tenants YA existentes (vía
 * `scripts/backfill-plantillas-alertas-operativas.ts`) y en
 * `TenantsRepository.crearConProvisioning` para tenants nuevos.
 */
export const PLANTILLAS_ALERTAS_OPERATIVAS_BASE: { canal: CanalNotificacion; clave: string; asunto?: string; cuerpo: string }[] = [
  {
    canal: 'EMAIL',
    clave: 'stock_bajo',
    asunto: 'Stock bajo de un producto',
    cuerpo: 'Un producto quedó con stock bajo: <strong>{{cantidad_actual}}</strong> unidades (mínimo configurado: {{stock_minimo}}).',
  },
  {
    canal: 'EMAIL',
    clave: 'ncf_por_agotarse',
    asunto: 'Secuencia de NCF {{tipo_ncf}} por agotarse',
    cuerpo: 'La secuencia de NCF <strong>{{tipo_ncf}}</strong> tiene solo <strong>{{restantes}}</strong> comprobantes restantes (umbral de aviso: {{umbral_alerta}}). Cargá una nueva secuencia en Configuración antes de que se agote.',
  },
  {
    canal: 'EMAIL',
    clave: 'whatsapp_requiere_atencion',
    asunto: 'Un cliente necesita atención por WhatsApp',
    cuerpo: 'El bot de WhatsApp no pudo resolver la consulta de <strong>{{telefono}}</strong> — revisalo en la Bandeja de WhatsApp.',
  },
  {
    canal: 'EMAIL',
    clave: 'lote_por_vencer',
    asunto: 'Lote por vencer: {{producto_nombre}}',
    cuerpo: 'El lote <strong>{{numero_lote}}</strong> de <strong>{{producto_nombre}}</strong> vence el {{fecha_vencimiento}} — quedan {{cantidad_actual}} unidades.',
  },
  {
    canal: 'EMAIL',
    clave: 'hito_proyecto_por_vencer',
    asunto: 'Hito por vencer: {{hito_nombre}}',
    cuerpo: 'El hito <strong>{{hito_nombre}}</strong> del proyecto <strong>{{proyecto_nombre}}</strong> vence el {{fecha_objetivo}}.',
  },
  {
    canal: 'EMAIL',
    clave: 'proyecto_presupuesto_superado',
    asunto: 'Presupuesto superado: {{proyecto_nombre}}',
    cuerpo: 'El proyecto <strong>{{proyecto_nombre}}</strong> superó su presupuesto: costo real RD$ {{costo_total}} contra un presupuesto de RD$ {{presupuesto}}.',
  },
];
