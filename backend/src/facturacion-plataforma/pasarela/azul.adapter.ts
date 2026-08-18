import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { CrearSesionPagoParams, PasarelaPagoAdapter, SesionPagoResultado } from './pasarela-pago.interface';

/**
 * Stub — demuestra que el patrón de adaptador admite sumar Azul (Banco
 * Popular) después sin tocar el resto del sistema (PasarelaPagoService,
 * el controller público, PagosPlataformaService), no hay credenciales
 * ni integración real todavía.
 */
@Injectable()
export class AzulAdapter implements PasarelaPagoAdapter {
  readonly clave = 'azul';
  readonly habilitado = false;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async crearSesionPago(params: CrearSesionPagoParams): Promise<SesionPagoResultado> {
    throw new ServiceUnavailableException('Azul no está configurado todavía');
  }
}
