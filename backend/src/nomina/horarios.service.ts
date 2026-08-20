import { BadRequestException, Injectable } from '@nestjs/common';
import { HorariosRepository } from './horarios.repository';
import { EmpleadosRepository } from './empleados.repository';
import { ReemplazarHorarioDto } from './dto/reemplazar-horario.dto';

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

    const diasVistos = new Set<string>();
    for (const dia of dto.dias) {
      if (diasVistos.has(dia.diaSemana)) {
        throw new BadRequestException(`El día ${dia.diaSemana} está repetido`);
      }
      diasVistos.add(dia.diaSemana);
      if (dia.horaSalida <= dia.horaEntrada) {
        throw new BadRequestException(`En ${dia.diaSemana}, horaSalida debe ser posterior a horaEntrada (no se soportan turnos que cruzan medianoche)`);
      }
    }

    return this.horariosRepository.reemplazar(tenantId, empleadoId, dto.dias);
  }
}
