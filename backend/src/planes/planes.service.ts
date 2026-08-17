import { Injectable } from '@nestjs/common';
import { PlanesRepository } from './planes.repository';
import { CrearPlanDto } from './dto/crear-plan.dto';
import { ActualizarPlanDto } from './dto/actualizar-plan.dto';

@Injectable()
export class PlanesService {
  constructor(private readonly planesRepository: PlanesRepository) {}

  listar() {
    return this.planesRepository.listar();
  }

  buscarPorId(id: string) {
    return this.planesRepository.buscarPorId(id);
  }

  listarModulos() {
    return this.planesRepository.listarModulos();
  }

  crear(dto: CrearPlanDto) {
    return this.planesRepository.crear(dto);
  }

  actualizar(id: string, dto: ActualizarPlanDto) {
    return this.planesRepository.actualizar(id, dto);
  }
}
