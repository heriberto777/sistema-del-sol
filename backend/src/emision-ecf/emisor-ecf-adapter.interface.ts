import { TipoNcf } from '@prisma/client';

/** Solo los tipos electrónicos (E3x) — el adaptador nunca ve B0x, esos no se firman/envían a ningún proveedor. */
export type TipoDocumentoECf = Extract<TipoNcf, 'E31' | 'E32' | 'E33' | 'E34'>;

export interface EmisorECfEmisor {
  rnc: string;
  razonSocial: string;
  direccion: string;
}

export interface EmisorECfReceptor {
  rnc?: string;
  razonSocial: string;
}

export interface EmisorECfLinea {
  numero: number;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  montoTotal: number;
}

/**
 * Forma neutral que necesita cualquier proveedor de e-CF — ni sabe ni
 * le importa si el documento viene de una `Factura` (tenant) o una
 * `FacturaPlataforma` (plataforma); ese mapeo lo hacen las piezas 2/3.
 */
export interface EmitirECfParams {
  tipo: TipoDocumentoECf;
  encf: string;
  fechaVencimientoSecuencia: Date;
  emisor: EmisorECfEmisor;
  receptor: EmisorECfReceptor;
  lineas: EmisorECfLinea[];
  montoTotal: number;
  itbisTotal: number;
}

export interface EmitirECfResultado {
  idExterno: string;
}

export type EstadoECf = 'ACEPTADO' | 'ACEPTADO_CONDICIONAL' | 'RECHAZADO' | 'EN_PROCESO';

export interface EstadoECfResultado {
  estado: EstadoECf;
  mensaje?: string;
}

export interface EmisorECfAdapter {
  emitir(params: EmitirECfParams): Promise<EmitirECfResultado>;
  consultarEstado(idExterno: string, tipo: TipoDocumentoECf): Promise<EstadoECfResultado>;
}
