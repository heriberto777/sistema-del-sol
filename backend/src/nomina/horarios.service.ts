import { Injectable } from '@nestjs/common';
import { HorariosRepository } from './horarios.repository';
import { EmpleadosRepository } from './empleados.repository';
import { ReemplazarHorarioDto } from './dto/reemplazar-horario.dto';
import { validarDiasHorario } from './validar-dias-horario.util';

@Injectable()
export class HorariosService {
  constructor(
    private readonly horariosRepository: HorariosRepository,
    private readonly empleadosRepository: EmpleadosRepository,
  ) {}

  async listar(empleadoId: string) {
    await this.empleadosRepository.buscarPorId(empleadoId);
    return this.horariosRepository.listarPorEmpleado(empleadoId);
  }

  async reemplazar(empleadoId: string, tenantId: string, dto: ReemplazarHorarioDto) {
    await this.empleadosRepository.buscarPorId(empleadoId);
    validarDiasHorario(dto.dias);
    return this.horariosRepository.reemplazar(tenantId, empleadoId, dto.dias);
  }
}
