import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { CrearSesionPagoParams, PasarelaPagoAdapter, SesionPagoResultado } from './pasarela-pago.interface';

/** Stub — ver comentario equivalente en azul.adapter.ts. */
@Injectable()
export class CardNetAdapter implements PasarelaPagoAdapter {
  readonly clave = 'cardnet';
  readonly habilitado = false;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async crearSesionPago(params: CrearSesionPagoParams): Promise<SesionPagoResultado> {
    throw new ServiceUnavailableException('CardNet no está configurado todavía');
  }
}
