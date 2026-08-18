export interface CrearSesionPagoParams {
  facturaId: string;
  concepto: string;
  montoPendiente: number;
  successUrl: string;
  cancelUrl: string;
}

export interface SesionPagoResultado {
  url: string;
  referenciaExterna: string;
}

/** Un adaptador por pasarela — ni el controller ni el resto del sistema conocen cuál está detrás (ver PasarelaPagoService). */
export interface PasarelaPagoAdapter {
  readonly clave: string;
  readonly habilitado: boolean;
  crearSesionPago(params: CrearSesionPagoParams): Promise<SesionPagoResultado>;
}
