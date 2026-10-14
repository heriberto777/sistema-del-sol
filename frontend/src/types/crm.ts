export type OrigenLead = 'MANUAL' | 'WHATSAPP' | 'FORMULARIO_WEB' | 'IMPORTACION' | 'REFERIDO';
export type EstadoLead = 'NUEVO' | 'CONTACTADO' | 'CALIFICADO' | 'DESCARTADO' | 'CONVERTIDO';
export type EstadoOportunidad = 'ABIERTA' | 'GANADA' | 'PERDIDA';
export type TipoActividadCrm = 'LLAMADA' | 'REUNION' | 'EMAIL' | 'NOTA' | 'TAREA';
export type EstadoCotizacionCrm = 'BORRADOR' | 'ENVIADA' | 'ACEPTADA' | 'RECHAZADA' | 'VENCIDA';

export interface CotizacionDeOportunidad {
  id: string;
  numero: string;
  estado: EstadoCotizacionCrm;
  total: string;
}

export const ETIQUETA_ESTADO_COTIZACION_CRM: Record<EstadoCotizacionCrm, string> = {
  BORRADOR: 'Borrador',
  ENVIADA: 'Enviada — esperando respuesta',
  ACEPTADA: 'Aprobada por el cliente',
  RECHAZADA: 'Rechazada por el cliente',
  VENCIDA: 'Vencida',
};

export interface UsuarioBasico {
  id: string;
  nombre: string;
}

export interface Lead {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  origen: OrigenLead;
  estado: EstadoLead;
  motivoDescarte: string | null;
  notas: string | null;
  vendedorId: string | null;
  vendedor: UsuarioBasico | null;
  clienteId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EtapaPipeline {
  id: string;
  nombre: string;
  orden: number;
  probabilidadDefault: number;
  color: string;
  createdAt: string;
}

export interface Oportunidad {
  id: string;
  titulo: string;
  clienteId: string | null;
  cliente: UsuarioBasico | null;
  leadId: string | null;
  lead: UsuarioBasico | null;
  etapaId: string;
  etapa: Pick<EtapaPipeline, 'id' | 'nombre' | 'color' | 'orden'>;
  montoEstimado: string;
  probabilidadPct: number;
  fechaCierreEstimada: string;
  vendedorId: string;
  vendedor: UsuarioBasico;
  estado: EstadoOportunidad;
  motivoPerdida: string | null;
  cotizacionId: string | null;
  cotizacion: CotizacionDeOportunidad | null;
  fechaCierreReal: string | null;
  createdAt: string;
}

export interface ActividadCrm {
  id: string;
  tipo: TipoActividadCrm;
  descripcion: string;
  clienteId: string | null;
  leadId: string | null;
  oportunidadId: string | null;
  fechaProgramada: string | null;
  completada: boolean;
  usuarioId: string;
  usuario: UsuarioBasico;
  createdAt: string;
}

export const ETIQUETA_ORIGEN_LEAD: Record<OrigenLead, string> = {
  MANUAL: 'Manual',
  WHATSAPP: 'WhatsApp',
  FORMULARIO_WEB: 'Formulario web',
  IMPORTACION: 'Importación',
  REFERIDO: 'Referido',
};

export const ETIQUETA_ESTADO_LEAD: Record<EstadoLead, string> = {
  NUEVO: 'Nuevo',
  CONTACTADO: 'Contactado',
  CALIFICADO: 'Calificado',
  DESCARTADO: 'Descartado',
  CONVERTIDO: 'Convertido',
};

export const TONO_ESTADO_LEAD: Record<EstadoLead, 'neutro' | 'advertencia' | 'exito' | 'peligro'> = {
  NUEVO: 'neutro',
  CONTACTADO: 'advertencia',
  CALIFICADO: 'exito',
  DESCARTADO: 'peligro',
  CONVERTIDO: 'exito',
};

export const ETIQUETA_TIPO_ACTIVIDAD: Record<TipoActividadCrm, string> = {
  LLAMADA: 'Llamada',
  REUNION: 'Reunión',
  EMAIL: 'Email',
  NOTA: 'Nota',
  TAREA: 'Tarea',
};

export type TipoEntradaTimeline = 'whatsapp' | 'lealtad' | 'cotizacion' | 'factura';

/** Ficha 360° (Fase 2) — ver ClienteTimelineService en el backend. */
export interface EntradaTimeline {
  tipo: TipoEntradaTimeline;
  fecha: string;
  resumen: string;
  meta?: { rol?: string; telefono?: string; id?: string };
}

/** Dashboard CRM (Fase 3) — ver CrmReportesService en el backend. */
export interface DashboardCrm {
  pipelineAbierto: { cantidad: number; montoTotal: number };
  ganadas: { cantidad: number; montoTotal: number };
  perdidas: { cantidad: number; montoTotal: number };
  tasaConversion: number | null;
  cicloPromedioDias: number | null;
  embudoLeads: Record<EstadoLead, number>;
  forecastPorMes: { mes: string; montoPonderado: number }[];
  rankingVendedores: { vendedorId: string; nombre: string; cantidadGanadas: number; montoGanado: number }[];
}

/** Meta de venta por vendedor/mes con progreso real ya calculado (Fase 3) — ver MetasVentaService en el backend. */
export interface MetaVenta {
  id: string;
  vendedorId: string;
  nombre: string;
  anio: number;
  mes: number;
  montoMeta: number;
  montoReal: number;
  porcentajeCumplido: number;
}
