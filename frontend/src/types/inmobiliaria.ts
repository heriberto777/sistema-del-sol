export interface ImagenPropiedad {
  id: string;
  imagen: string;
  orden: number;
}

export interface AgenteOpcion {
  id: string;
  nombre: string;
}

/** Cliente dueño de un inmueble (Modelo 2) — mismo shape liviano que AgenteOpcion, entidad distinta. */
export interface ClienteOpcion {
  id: string;
  nombre: string;
}

/** Shape del agente en el catálogo PÚBLICO — sin id, con teléfono para el link de WhatsApp (ver InmobiliariaPublicaService). */
export interface AgentePublico {
  nombre: string;
  telefono: string | null;
}

export interface Propiedad {
  id: string;
  codigo: string;
  titulo: string;
  tipo: string;
  operacion: string;
  estado: string;
  precio: string;
  moneda: string;
  ubicacion: string;
  habitaciones: number | null;
  banos: string | null;
  parqueos: number | null;
  metrosConstruccion: string | null;
  metrosTerreno: string | null;
  descripcion: string | null;
  amenidades: string[];
  agenteId: string | null;
  agente: AgenteOpcion | null;
  // Modelo 2 (administradora de alquileres) — dueño del inmueble, distinto del agente.
  propietarioId: string | null;
  propietario: ClienteOpcion | null;
  // Modelo 3 (preventa) — Proyecto vinculado (plugin Proyectos), null si no está en preventa.
  proyectoPreventaId: string | null;
  proyectoPreventa: { id: string; nombre: string; estado: string } | null;
  imagenes: ImagenPropiedad[];
}

/** Shape que devuelve el catálogo PÚBLICO (`InmobiliariaPublicaService`) — mismos campos salvo `agente`/sin `agenteId`, ver AgentePublico. */
export interface PropiedadPublica extends Omit<Propiedad, 'agenteId' | 'agente'> {
  agente: AgentePublico | null;
}

export const TIPOS_PROPIEDAD = [
  'APARTAMENTO',
  'CASA',
  'VILLA',
  'PENTHOUSE',
  'CONDOMINIO',
  'SOLAR',
  'LOCAL_COMERCIAL',
  'OFICINA',
  'NAVE_INDUSTRIAL',
  'EDIFICIO',
  'FINCA',
] as const;

export const ETIQUETA_TIPO_PROPIEDAD: Record<string, string> = {
  APARTAMENTO: 'Apartamento',
  CASA: 'Casa',
  VILLA: 'Villa',
  PENTHOUSE: 'Penthouse',
  CONDOMINIO: 'Condominio',
  SOLAR: 'Solar',
  LOCAL_COMERCIAL: 'Local comercial',
  OFICINA: 'Oficina',
  NAVE_INDUSTRIAL: 'Nave industrial',
  EDIFICIO: 'Edificio',
  FINCA: 'Finca',
};

export const OPERACIONES_PROPIEDAD = ['VENTA', 'ALQUILER'] as const;
export const ETIQUETA_OPERACION_PROPIEDAD: Record<string, string> = { VENTA: 'Venta', ALQUILER: 'Alquiler' };

export const ESTADOS_PROPIEDAD = ['ACTIVA', 'PAUSADA', 'RESERVADA', 'VENDIDA', 'ALQUILADA'] as const;
export const ETIQUETA_ESTADO_PROPIEDAD: Record<string, string> = {
  ACTIVA: 'Activa',
  PAUSADA: 'Pausada',
  RESERVADA: 'Reservada',
  VENDIDA: 'Vendida',
  ALQUILADA: 'Alquilada',
};

/** Sugeridas en el formulario — el campo real (`Propiedad.amenidades`) acepta cualquier texto libre, ver schema.prisma. */
export const AMENIDADES_SUGERIDAS = ['Piscina', 'Gimnasio', 'Seguridad 24h', 'Ascensor', 'Balcón', 'Área social', 'Parqueo techado', 'Terraza'];

/** Solo "cerrable" en estos estados — VENDIDA/ALQUILADA ya tienen un contrato activo. */
export const ESTADOS_PROPIEDAD_CERRABLE = new Set(['ACTIVA', 'PAUSADA', 'RESERVADA']);

export interface Contrato {
  id: string;
  propiedad: { id: string; codigo: string; titulo: string; propietarioId: string | null };
  cliente: { id: string; nombre: string };
  tipo: string;
  monto: string;
  moneda: string;
  fecha: string;
  agente: AgenteOpcion | null;
  porcentajeComision: string | null;
  montoComision: string;
  comisionPagada: boolean;
  comisionPagadaEn: string | null;
  estado: string;
  notas: string | null;
  // Modelo 2 (administradora de alquileres) — solo tiene sentido si tipo === 'ALQUILER'.
  administracionActiva: boolean;
  porcentajeComisionAdministracion: string | null;
  proximoCobroAlquilerEn: string | null;
}

export const ESTADOS_CONTRATO = ['ACTIVO', 'ANULADO'] as const;
export const ETIQUETA_ESTADO_CONTRATO: Record<string, string> = { ACTIVO: 'Activo', ANULADO: 'Anulado' };

/** Modelo 2 — un cobro mensual de renta generado por el cron para un ContratoPropiedad bajo administración. */
export interface CobroAlquiler {
  id: string;
  contratoPropiedad: {
    id: string;
    clienteId: string;
    propiedad: { id: string; codigo: string; titulo: string; propietarioId: string | null };
    cliente: { id: string; nombre: string };
  };
  periodo: string;
  montoAlquiler: string;
  porcentajeComisionAdmin: string | null;
  montoComisionAdmin: string;
  montoPropietario: string;
  estado: 'PENDIENTE' | 'COBRADO' | 'LIQUIDADO';
  facturaId: string | null;
  fechaCobro: string | null;
  fechaLiquidacion: string | null;
  createdAt: string;
}

export const ESTADOS_COBRO_ALQUILER = ['PENDIENTE', 'COBRADO', 'LIQUIDADO'] as const;
export const ETIQUETA_ESTADO_COBRO_ALQUILER: Record<string, string> = {
  PENDIENTE: 'Pendiente de cobrar',
  COBRADO: 'Cobrado — falta liquidar',
  LIQUIDADO: 'Liquidado al propietario',
};
