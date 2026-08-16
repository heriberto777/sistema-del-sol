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
}
