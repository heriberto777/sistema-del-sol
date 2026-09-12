export interface PasajeroTravel {
  id: string;
  nombre: string;
  apellido: string;
  fechaNacimiento: string | null;
  tipoDocumento: string | null;
  numeroDocumento: string | null;
  email: string | null;
  telefono: string | null;
}

export interface TravelReserva {
  id: string;
  codigoInterno: string;
  clienteId: string;
  cliente: { id: string; nombre: string };
  tipo: 'VUELO' | 'HOTEL';
  estado: 'PENDIENTE' | 'CONFIRMADA' | 'FACTURADA' | 'CANCELADA';
  moneda: string;
  montoCosto: string;
  montoVenta: string;
  notas: string | null;
  facturaId: string | null;
  pasajeros: PasajeroTravel[];
  createdAt: string;
  updatedAt: string;
}

export const TIPOS_TRAVEL_RESERVA = ['VUELO', 'HOTEL'] as const;
export const ETIQUETA_TIPO_TRAVEL_RESERVA: Record<string, string> = { VUELO: 'Vuelo', HOTEL: 'Hotel' };

export const ESTADOS_TRAVEL_RESERVA = ['PENDIENTE', 'CONFIRMADA', 'FACTURADA', 'CANCELADA'] as const;
export const ETIQUETA_ESTADO_TRAVEL_RESERVA: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADA: 'Confirmada',
  FACTURADA: 'Facturada',
  CANCELADA: 'Cancelada',
};
export const COLOR_ESTADO_TRAVEL_RESERVA: Record<string, string> = {
  PENDIENTE: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  CONFIRMADA: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  FACTURADA: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  CANCELADA: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
};
