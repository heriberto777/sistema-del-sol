import { BadRequestException, Injectable } from '@nestjs/common';
import { DiaSemana } from '@prisma/client';
import { AsistenciaRepository } from './asistencia.repository';
import { EmpleadosRepository } from './empleados.repository';
import { HorariosRepository } from './horarios.repository';
import { RegistrarAsistenciaManualDto } from './dto/registrar-asistencia-manual.dto';
import { ListarAsistenciaQueryDto } from './dto/listar-asistencia-query.dto';
import { fechaHoyRD, horaActualRD } from '../common/utils/zona-horaria-rd.util';
import { paginar } from '../common/types/pagina-resultado';

const DIAS_POR_INDICE_UTC: DiaSemana[] = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

@Injectable()
export class AsistenciaService {
  constructor(
    private readonly asistenciaRepository: AsistenciaRepository,
    private readonly empleadosRepository: EmpleadosRepository,
    private readonly horariosRepository: HorariosRepository,
  ) {}

  private async resolverEmpleadoDeUsuario(userId: string) {
    const empleado = await this.empleadosRepository.buscarPorUserId(userId);
    if (!empleado) {
      throw new BadRequestException('Tu usuario no tiene un empleado de RRHH vinculado — pedile a RRHH que te asocie primero.');
    }
    return empleado;
  }

  /** `tardanza` se calcula UNA vez al marcar la entrada, comparando contra HorarioEmpleado del día — sin horario configurado ese día, no hay contra qué comparar. */
  private async calcularTardanza(empleadoId: string, fecha: Date, horaEntradaReal: string) {
    const diaSemana = DIAS_POR_INDICE_UTC[fecha.getUTCDay()];
    const horarios = await this.horariosRepository.listarPorEmpleado(empleadoId);
    const horarioDelDia = horarios.find((h) => h.diaSemana === diaSemana);
    return horarioDelDia ? horaEntradaReal > horarioDelDia.horaEntrada : false;
  }

  private fechaHoyComoDate() {
    return new Date(`${fechaHoyRD()}T00:00:00.000Z`);
  }

  /** Para el widget de autoservicio: si el usuario no tiene empleado vinculado, no hay nada que ofrecerle marcar. */
  async miEstadoHoy(userId: string, tenantId: string) {
    const empleado = await this.empleadosRepository.buscarPorUserId(userId);
    if (!empleado) return { tieneEmpleado: false, registro: null };

    const registro = await this.asistenciaRepository.buscarDelDia(tenantId, empleado.id, this.fechaHoyComoDate());
    return { tieneEmpleado: true, registro };
  }

  async marcarEntrada(userId: string, tenantId: string) {
    const empleado = await this.resolverEmpleadoDeUsuario(userId);
    const fecha = this.fechaHoyComoDate();
    const existente = await this.asistenciaRepository.buscarDelDia(tenantId, empleado.id, fecha);
    if (existente?.horaEntrada) {
      throw new BadRequestException('Ya marcaste tu entrada de hoy');
    }

    const horaEntrada = horaActualRD();
    const tardanza = await this.calcularTardanza(empleado.id, fecha, horaEntrada);

    if (existente) {
      return this.asistenciaRepository.actualizar(existente.id, { horaEntrada, tardanza });
    }
    return this.asistenciaRepository.crear({ tenantId, empleadoId: empleado.id, fecha, horaEntrada, tardanza });
  }

  async marcarSalida(userId: string, tenantId: string) {
    const empleado = await this.resolverEmpleadoDeUsuario(userId);
    const fecha = this.fechaHoyComoDate();
    const existente = await this.asistenciaRepository.buscarDelDia(tenantId, empleado.id, fecha);
    if (!existente?.horaEntrada) {
      throw new BadRequestException('Todavía no marcaste tu entrada de hoy');
    }
    if (existente.horaSalida) {
      throw new BadRequestException('Ya marcaste tu salida de hoy');
    }

    return this.asistenciaRepository.actualizar(existente.id, { horaSalida: horaActualRD() });
  }

  async registrarManual(dto: RegistrarAsistenciaManualDto, tenantId: string) {
    await this.empleadosRepository.buscarPorId(dto.empleadoId);
    const fecha = new Date(`${dto.fecha}T00:00:00.000Z`);
    const existente = await this.asistenciaRepository.buscarDelDia(tenantId, dto.empleadoId, fecha);

    const horaEntrada = dto.horaEntrada ?? existente?.horaEntrada ?? undefined;
    const tardanza = dto.horaEntrada ? await this.calcularTardanza(dto.empleadoId, fecha, dto.horaEntrada) : (existente?.tardanza ?? false);
    const horaSalida = dto.horaSalida ?? existente?.horaSalida ?? undefined;

    if (existente) {
      return this.asistenciaRepository.actualizar(existente.id, { horaEntrada, horaSalida, tardanza });
    }
    return this.asistenciaRepository.crear({ tenantId, empleadoId: dto.empleadoId, fecha, horaEntrada, horaSalida, tardanza });
  }

  async listar(query: ListarAsistenciaQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.asistenciaRepository.listar({
      empleadoId: query.empleadoId,
      desde: query.desde ? new Date(query.desde) : undefined,
      hasta: query.hasta ? new Date(query.hasta) : undefined,
      skip,
      take,
    });
    return { datos, total, pagina, tamanoPagina };
  }
}
