import { CanalNotificacion } from '@prisma/client';

export interface EventoNotificacion {
  clave: string;
  etiqueta: string;
  modulo: string;
  /** Solo los canales que el listener de ese evento realmente usa (ver notificaciones.service.ts) — crear una plantilla de un canal no listado acá no rompe nada, simplemente nunca se dispara. */
  canales: CanalNotificacion[];
  descripcion: string;
  variables: { nombre: string; descripcion: string }[];
}

/**
 * Única fuente de verdad para el selector de "Plantillas de notificación"
 * del frontend — antes el admin tenía que escribir a mano la `clave`
 * interna del evento (ej. "factura_creada") sin ninguna guía de qué
 * eventos existen ni qué variables acepta cada uno (pedido explícito del
 * usuario: "no entiendo cómo vincular la plantilla a una acción").
 *
 * Deliberadamente NO se valida `CrearPlantillaDto.clave` contra este
 * catálogo en el backend — sigue aceptando cualquier string, así que
 * agregar un evento nuevo acá es solo para mejorar la UX de selección,
 * nunca una restricción que pueda romper una plantilla ya guardada con
 * una clave que quedó vieja.
 */
export const CATALOGO_EVENTOS_NOTIFICACION: EventoNotificacion[] = [
  {
    clave: 'factura_creada',
    etiqueta: 'Factura creada',
    modulo: 'Ventas',
    canales: ['EMAIL', 'WHATSAPP'],
    descripcion: 'Al crear una factura, si el cliente tiene email/teléfono cargado.',
    variables: [
      { nombre: 'cliente_nombre', descripcion: 'Nombre del cliente' },
      { nombre: 'factura_total', descripcion: 'Total de la factura' },
      { nombre: 'link', descripcion: 'Link público para ver/pagar la factura' },
    ],
  },
  {
    clave: 'cotizacion_enviada',
    etiqueta: 'Cotización enviada',
    modulo: 'Ventas',
    canales: ['EMAIL', 'WHATSAPP'],
    descripcion: 'Al apretar "Enviar" en una cotización, si el cliente tiene email/teléfono cargado.',
    variables: [
      { nombre: 'cliente_nombre', descripcion: 'Nombre del cliente' },
      { nombre: 'cotizacion_numero', descripcion: 'Número de la cotización' },
      { nombre: 'cotizacion_total', descripcion: 'Total de la cotización' },
      { nombre: 'link', descripcion: 'Link público para ver la cotización' },
    ],
  },
  {
    clave: 'ncf_por_agotarse',
    etiqueta: 'NCF por agotarse',
    modulo: 'Ventas',
    canales: ['EMAIL'],
    descripcion: 'Cuando quedan pocos comprobantes fiscales disponibles de un tipo. Se avisa a Admin Total.',
    variables: [
      { nombre: 'tipo_ncf', descripcion: 'Tipo de comprobante (ej. B01, B02)' },
      { nombre: 'restantes', descripcion: 'Comprobantes que quedan' },
      { nombre: 'umbral_alerta', descripcion: 'A partir de cuántos restantes se avisa' },
    ],
  },
  {
    clave: 'stock_bajo',
    etiqueta: 'Stock bajo',
    modulo: 'Inventario',
    canales: ['EMAIL'],
    descripcion: 'Cuando el stock de un producto cae por debajo del mínimo configurado. Se avisa a Admin Total y Almacenero.',
    variables: [
      { nombre: 'producto_id', descripcion: 'Identificador del producto' },
      { nombre: 'cantidad_actual', descripcion: 'Cantidad disponible ahora' },
      { nombre: 'stock_minimo', descripcion: 'Mínimo configurado' },
    ],
  },
  {
    clave: 'lote_por_vencer',
    etiqueta: 'Lote por vencer',
    modulo: 'Inventario',
    canales: ['EMAIL'],
    descripcion: 'Cuando un lote de producto está próximo a vencer. Se avisa a Admin Total y Almacenero.',
    variables: [
      { nombre: 'producto_nombre', descripcion: 'Nombre del producto' },
      { nombre: 'numero_lote', descripcion: 'Número de lote' },
      { nombre: 'fecha_vencimiento', descripcion: 'Fecha de vencimiento' },
      { nombre: 'cantidad_actual', descripcion: 'Cantidad restante de ese lote' },
    ],
  },
  {
    clave: 'whatsapp_requiere_atencion',
    etiqueta: 'WhatsApp requiere atención',
    modulo: 'WhatsApp',
    canales: ['EMAIL'],
    descripcion: 'Cuando el bot de WhatsApp no puede seguir solo y hace falta que un humano responda. Se avisa a Admin Total.',
    variables: [{ nombre: 'telefono', descripcion: 'Teléfono de quien escribió' }],
  },
  {
    clave: 'hito_proyecto_por_vencer',
    etiqueta: 'Hito de proyecto por vencer',
    modulo: 'Proyectos',
    canales: ['EMAIL'],
    descripcion: 'Cuando un hito de un proyecto entra en su ventana de aviso. Se avisa al responsable (o a Admin Total si no tiene uno).',
    variables: [
      { nombre: 'hito_nombre', descripcion: 'Nombre del hito' },
      { nombre: 'proyecto_nombre', descripcion: 'Nombre del proyecto' },
      { nombre: 'fecha_objetivo', descripcion: 'Fecha objetivo del hito' },
    ],
  },
  {
    clave: 'proyecto_presupuesto_superado',
    etiqueta: 'Presupuesto de proyecto superado',
    modulo: 'Proyectos',
    canales: ['EMAIL'],
    descripcion: 'Cuando el costo real (horas + gastos) de un proyecto supera su presupuesto por primera vez.',
    variables: [
      { nombre: 'proyecto_nombre', descripcion: 'Nombre del proyecto' },
      { nombre: 'presupuesto', descripcion: 'Presupuesto del proyecto' },
      { nombre: 'costo_total', descripcion: 'Costo real acumulado' },
    ],
  },
  {
    clave: 'tarea_proyecto_comentario_nuevo',
    etiqueta: 'Comentario nuevo en tarea de proyecto',
    modulo: 'Proyectos',
    canales: ['EMAIL', 'WHATSAPP'],
    descripcion: 'Cuando alguien comenta una tarea de un proyecto. Se avisa a los responsables (menos a quien comentó).',
    variables: [
      { nombre: 'autor_nombre', descripcion: 'Quién comentó' },
      { nombre: 'tarea_titulo', descripcion: 'Título de la tarea' },
      { nombre: 'proyecto_nombre', descripcion: 'Nombre del proyecto' },
      { nombre: 'contenido', descripcion: 'Texto del comentario' },
    ],
  },
  {
    clave: 'tarea_proyecto_vence_hoy',
    etiqueta: 'Tarea de proyecto vence hoy',
    modulo: 'Proyectos',
    canales: ['EMAIL', 'WHATSAPP'],
    descripcion: 'El día que vence una tarea de un proyecto. Se avisa a sus responsables.',
    variables: [
      { nombre: 'tarea_titulo', descripcion: 'Título de la tarea' },
      { nombre: 'proyecto_nombre', descripcion: 'Nombre del proyecto' },
    ],
  },
  {
    clave: 'tarea_personal_vence_hoy',
    etiqueta: 'Tarea personal vence hoy',
    modulo: 'Mis Tareas',
    canales: ['EMAIL', 'WHATSAPP'],
    descripcion: 'El día que vence una tarea personal (Mis Tareas). Se avisa a su dueño.',
    variables: [{ nombre: 'tarea_titulo', descripcion: 'Título de la tarea' }],
  },
  {
    clave: 'crm_actividad_vence_hoy',
    etiqueta: 'Actividad de CRM vence hoy',
    modulo: 'CRM',
    canales: ['EMAIL', 'WHATSAPP'],
    descripcion: 'El día que vence una actividad programada en el CRM (llamada, reunión, tarea). Se avisa a su dueño.',
    variables: [{ nombre: 'actividad_descripcion', descripcion: 'Descripción de la actividad' }],
  },
  {
    clave: 'publicacion_social_pendiente_aprobacion',
    etiqueta: 'Publicación pendiente de aprobar',
    modulo: 'Publicaciones Sociales',
    canales: ['EMAIL'],
    descripcion: 'Cuando un diseño queda listo para revisar. Se avisa a todos los que tengan permiso de aprobar.',
    variables: [
      { nombre: 'producto_nombre', descripcion: 'Producto del diseño' },
      { nombre: 'link', descripcion: 'Link a Publicaciones Sociales' },
    ],
  },
  {
    clave: 'publicacion_social_cambios_solicitados',
    etiqueta: 'Publicación — cambios solicitados',
    modulo: 'Publicaciones Sociales',
    canales: ['EMAIL'],
    descripcion: 'Cuando un aprobador pide cambios a un diseño. Se avisa a quien lo creó.',
    variables: [
      { nombre: 'producto_nombre', descripcion: 'Producto del diseño' },
      { nombre: 'comentario', descripcion: 'Comentario del aprobador' },
      { nombre: 'link', descripcion: 'Link a Publicaciones Sociales' },
    ],
  },
  {
    clave: 'publicacion_social_aprobada',
    etiqueta: 'Publicación aprobada',
    modulo: 'Publicaciones Sociales',
    canales: ['EMAIL'],
    descripcion: 'Cuando se aprueba un diseño. Se avisa a quien lo creó.',
    variables: [
      { nombre: 'producto_nombre', descripcion: 'Producto del diseño' },
      { nombre: 'link', descripcion: 'Link a Publicaciones Sociales' },
    ],
  },
  {
    clave: 'publicacion_social_rechazada',
    etiqueta: 'Publicación rechazada',
    modulo: 'Publicaciones Sociales',
    canales: ['EMAIL'],
    descripcion: 'Cuando se rechaza un diseño. Se avisa a quien lo creó.',
    variables: [
      { nombre: 'producto_nombre', descripcion: 'Producto del diseño' },
      { nombre: 'motivo_rechazo', descripcion: 'Motivo del rechazo' },
    ],
  },
];
