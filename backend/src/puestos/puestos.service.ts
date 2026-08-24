import { Injectable } from '@nestjs/common';
import { PuestosRepository } from './puestos.repository';
import { CrearPuestoDto } from './dto/crear-puesto.dto';

@Injectable()
export class PuestosService {
  constructor(private readonly puestosRepository: PuestosRepository) {}

  crear(dto: CrearPuestoDto, tenantId: string) {
    return this.puestosRepository.crear(dto, tenantId);
  }

  listar(soloActivos: boolean) {
    return this.puestosRepository.listar(soloActivos);
  }

  actualizar(id: string, dto: Partial<CrearPuestoDto>) {
    return this.puestosRepository.actualizar(id, dto);
  }
}
