import { Injectable } from '@nestjs/common';
import { ConfiguracionesRepository } from './configuraciones.repository';

@Injectable()
export class ConfiguracionesService {
  constructor(private readonly configuracionesRepository: ConfiguracionesRepository) {}

  listar() {
    return this.configuracionesRepository.listar();
  }

  actualizar(clave: string, valor: string, tenantId: string) {
    return this.configuracionesRepository.actualizar(clave, valor, tenantId);
  }

  /** Único punto donde una Configuracion se lee programáticamente (ver PosService.cerrarTurno) — cae al default si el tenant no la tiene sembrada. */
  async buscarValor(clave: string, tenantId: string, valorDefault: string): Promise<string> {
    const fila = await this.configuracionesRepository.buscarPorClave(clave, tenantId);
    return fila?.valor ?? valorDefault;
  }
}
