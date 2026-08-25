import { PasarelaConfigTenant, SesionCobroFactura } from '@prisma/client';

/**
 * Interfaz LOCAL a este módulo — a propósito distinta de
 * `PasarelaPagoAdapter` (`facturacion-plataforma/pasarela/`), que asume un
 * redirect GET simple `{url, referenciaExterna}` y no encaja con AZUL
 * (formulario HTML firmado, sin sesión de servidor). Tocar esa interfaz
 * para acomodar esto arriesgaría la integración de Stripe ya en producción
 * para la facturación de plataforma.
 */
export interface ResultadoCheckoutCobro {
  metodo: 'GET' | 'POST';
  url: string;
  /** Solo si metodo === 'POST' — el frontend arma un <form> oculto con estos campos y lo autoenvía. */
  campos?: Record<string, string>;
  referenciaExterna: string;
  /** Ej. el `sk` de sesión de CardNet — se guarda cifrado en SesionCobroFactura.datosVerificacion. */
  datosVerificacion?: string;
}

export interface ResultadoVerificacionCobro {
  aprobado: boolean;
  /** Motivo legible para logging/depuración — nunca se le muestra crudo al cliente final. */
  detalle?: string;
}

export interface CrearCheckoutParams {
  facturaId: string;
  monto: number;
  config: PasarelaConfigTenant;
  /** URLs de retorno ya armadas por el controller público (apuntan al backend, no al frontend — ver cobros-publicos.controller.ts). */
  urlRetorno: string;
  urlCancelacion: string;
}

export interface PasarelaCobroAdapter {
  readonly clave: 'AZUL' | 'CARDNET';
  crearCheckout(params: CrearCheckoutParams): Promise<ResultadoCheckoutCobro>;
  /** `query` son los parámetros crudos recibidos en el retorno (querystring de Azul, o los que correspondan a CardNet). */
  verificarRetorno(query: Record<string, string>, sesion: SesionCobroFactura, config: PasarelaConfigTenant): Promise<ResultadoVerificacionCobro>;
}
