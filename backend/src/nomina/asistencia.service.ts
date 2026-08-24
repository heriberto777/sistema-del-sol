import { BadRequestException, Injectable } from '@nestjs/common';
import { DiaSemana } from '@prisma/client';
import { AsistenciaRepository } from './asistencia.repository';
import { EmpleadosRepository } from './empleados.repository';
import { HorariosRepository } from './horarios.repository';
import { ConfiguracionesService } from '../configuraciones/configuraciones.service';
import { CONFIGURACIONES_BASE } from '../tenants/roles-base';
import { RegistrarAsistenciaManualDto } from './dto/registrar-asistencia-manual.dto';
import { ListarAsistenciaQueryDto } from './dto/listar-asistencia-query.dto';
import { fechaHoyRD, horaActualRD } from '../common/utils/zona-horaria-rd.util';
import { paginar } from '../common/types/pagina-resultado';

const DIAS_POR_INDICE_UTC: DiaSemana[] = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

const CLAVE_UMBRAL_HORAS_EXTRA = 'ASISTENCIA_UMBRAL_HORAS_EXTRA';
const CLAVE_TOLERANCIA_SALIDA_ANTICIPADA = 'ASISTENCIA_TOLERANCIA_SALIDA_ANTICIPADA_MIN';

/** "HH:MM" -> minutos desde medianoche, para restar/comparar horas del mismo día. */
function minutosDesdeHHMM(hhmm: string): number {
  const [horas, minutos] = hhmm.split(':').map(Number);
  return horas * 60 + minutos;
}

@Injectable()
export class AsistenciaService {
  constructor(
    private readonly asistenciaRepository: AsistenciaRepository,
    private readonly empleadosRepository: EmpleadosRepository,
    private readonly horariosRepository: HorariosRepository,
    private readonly configuracionesService: ConfiguracionesService,
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

  /**
   * `salidaAnticipada`/`horasExtra` (plan de integración Cuadre, ítem
   * G-4) se calculan UNA vez al marcar la salida (o en registrarManual si
   * viene horaSalida), igual criterio que `tardanza`: `salidaAnticipada`
   * compara contra `HorarioEmpleado` del día (sin horario configurado, no
   * hay contra qué comparar); `horasExtra` no depende del horario, solo
   * de las horas trabajadas ese día contra el umbral configurable — sin
   * `horaEntrada` no hay forma de calcular horas trabajadas, así que
   * queda `null` (no 0 — 0 significa "se calculó y no hubo excedente").
   */
  private async calcularHorasExtraYSalidaAnticipada(
    empleadoId: string,
    tenantId: string,
    fecha: Date,
    horaEntrada: string | undefined,
    horaSalida: string,
  ): Promise<{ salidaAnticipada: boolean; horasExtra: number | null }> {
    const diaSemana = DIAS_POR_INDICE_UTC[fecha.getUTCDay()];
    const horarios = await this.horariosRepository.listarPorEmpleado(empleadoId);
    const horarioDelDia = horarios.find((h) => h.diaSemana === diaSemana);

    let salidaAnticipada = false;
    if (horarioDelDia) {
      const toleranciaMin = Number(
        await this.configuracionesService.buscarValor(CLAVE_TOLERANCIA_SALIDA_ANTICIPADA, tenantId, CONFIGURACIONES_BASE[CLAVE_TOLERANCIA_SALIDA_ANTICIPADA]),
      );
      salidaAnticipada = minutosDesdeHHMM(horaSalida) < minutosDesdeHHMM(horarioDelDia.horaSalida) - toleranciaMin;
    }

    let horasExtra: number | null = null;
    if (horaEntrada) {
      const umbralHoras = Number(
        await this.configuracionesService.buscarValor(CLAVE_UMBRAL_HORAS_EXTRA, tenantId, CONFIGURACIONES_BASE[CLAVE_UMBRAL_HORAS_EXTRA]),
      );
      const horasTrabajadas = (minutosDesdeHHMM(horaSalida) - minutosDesdeHHMM(horaEntrada)) / 60;
      horasExtra = Math.round(Math.max(0, horasTrabajadas - umbralHoras) * 100) / 100;
    }

    return { salidaAnticipada, horasExtra };
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

    const horaSalida = horaActualRD();
    const { salidaAnticipada, horasExtra } = await this.calcularHorasExtraYSalidaAnticipada(
      empleado.id,
      tenantId,
      fecha,
      existente.horaEntrada ?? undefined,
      horaSalida,
    );
    return this.asistenciaRepository.actualizar(existente.id, { horaSalida, salidaAnticipada, horasExtra });
  }

  async registrarManual(dto: RegistrarAsistenciaManualDto, tenantId: string) {
    await this.empleadosRepository.buscarPorId(dto.empleadoId);
    const fecha = new Date(`${dto.fecha}T00:00:00.000Z`);
    const existente = await this.asistenciaRepository.buscarDelDia(tenantId, dto.empleadoId, fecha);

    const horaEntrada = dto.horaEntrada ?? existente?.horaEntrada ?? undefined;
    const tardanza = dto.horaEntrada ? await this.calcularTardanza(dto.empleadoId, fecha, dto.horaEntrada) : (existente?.tardanza ?? false);
    const horaSalida = dto.horaSalida ?? existente?.horaSalida ?? undefined;

    // Recalcula solo si esta llamada trajo un dato nuevo que afecte el
    // resultado (horaEntrada u horaSalida) — conservar lo ya calculado si
    // solo se está tocando otro campo (mismo criterio que `tardanza`).
    const debeRecalcular = !!horaSalida && (dto.horaSalida !== undefined || dto.horaEntrada !== undefined);
    const { salidaAnticipada, horasExtra } = debeRecalcular
      ? await this.calcularHorasExtraYSalidaAnticipada(dto.empleadoId, tenantId, fecha, horaEntrada, horaSalida)
      : { salidaAnticipada: existente?.salidaAnticipada ?? false, horasExtra: existente?.horasExtra != null ? Number(existente.horasExtra) : null };

    if (existente) {
      return this.asistenciaRepository.actualizar(existente.id, { horaEntrada, horaSalida, tardanza, salidaAnticipada, horasExtra });
    }
    return this.asistenciaRepository.crear({
      tenantId,
      empleadoId: dto.empleadoId,
      fecha,
      horaEntrada,
      horaSalida,
      tardanza,
      salidaAnticipada,
      horasExtra,
    });
  }

  async listar(query: ListarAsistenciaQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.asistenciaRepository.listar({
      empleadoId: query.empleadoId,
      desde: query.desde ? new Date(query.desde) : undefined,
      hasta: query.hasta ? new Date(query.hasta) : undefined,
      estado: query.estado,
      skip,
      take,
    });
    return { datos, total, pagina, tamanoPagina };
  }

  /** Plan de integración Cuadre, ítem G-3 — mismo patrón que AusenciasService.cambiarEstado. Puramente de revisión: no afecta nómina (ver comentario en el schema). */
  async cambiarEstado(id: string, estado: 'APROBADO' | 'RECHAZADO', aprobadoPorId: string) {
    const registro = await this.asistenciaRepository.buscarPorId(id);
    if (registro.estado !== 'PENDIENTE') {
      throw new BadRequestException('Solo un registro PENDIENTE puede aprobarse o rechazarse');
    }
    return this.asistenciaRepository.actualizarEstado(id, estado, aprobadoPorId, new Date());
  }
}
