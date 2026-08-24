import { Injectable } from '@nestjs/common';
import { PlantillasHorarioRepository } from './plantillas-horario.repository';
import { CrearPlantillaHorarioDto } from './dto/crear-plantilla-horario.dto';
import { ReemplazarDiasPlantillaDto } from './dto/reemplazar-dias-plantilla.dto';
import { validarDiasHorario } from '../nomina/validar-dias-horario.util';

@Injectable()
export class PlantillasHorarioService {
  constructor(private readonly plantillasHorarioRepository: PlantillasHorarioRepository) {}

  crear(dto: CrearPlantillaHorarioDto, tenantId: string) {
    return this.plantillasHorarioRepository.crear(dto, tenantId);
  }

  listar(soloActivas: boolean) {
    return this.plantillasHorarioRepository.listar(soloActivas);
  }

  buscarPorId(id: string) {
    return this.plantillasHorarioRepository.buscarPorId(id);
  }

  actualizar(id: string, dto: Partial<CrearPlantillaHorarioDto>, tenantId: string) {
    return this.plantillasHorarioRepository.actualizar(id, dto, tenantId);
  }

  async reemplazarDias(id: string, dto: ReemplazarDiasPlantillaDto) {
    await this.plantillasHorarioRepository.buscarPorId(id);
    validarDiasHorario(dto.dias);
    return this.plantillasHorarioRepository.reemplazarDias(id, dto.dias);
  }
}
