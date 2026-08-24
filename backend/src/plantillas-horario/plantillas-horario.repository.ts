import { Injectable } from '@nestjs/common';
import { DiaSemana } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearPlantillaHorarioDto } from './dto/crear-plantilla-horario.dto';

@Injectable()
export class PlantillasHorarioRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  async crear(dto: CrearPlantillaHorarioDto, tenantId: string) {
    if (dto.predeterminada) {
      await this.desmarcarPredeterminadaDeOtras(tenantId);
    }
    return this.db.plantillaHorario.create({ data: { ...dto, tenantId } });
  }

  listar(soloActivas: boolean) {
    return this.db.plantillaHorario.findMany({
      where: soloActivas ? { activa: true } : undefined,
      orderBy: { nombre: 'asc' },
      include: { dias: { orderBy: { diaSemana: 'asc' } } },
    });
  }

  buscarPorId(id: string) {
    return this.db.plantillaHorario.findUniqueOrThrow({ where: { id }, include: { dias: { orderBy: { diaSemana: 'asc' } } } });
  }

  /** Plantilla marcada `predeterminada` (a lo sumo una por tenant) — usada por EmpleadosService.crear() para auto-asignar. */
  buscarPredeterminada() {
    return this.db.plantillaHorario.findFirst({ where: { predeterminada: true, activa: true } });
  }

  async actualizar(id: string, dto: Partial<CrearPlantillaHorarioDto>, tenantId: string) {
    if (dto.predeterminada) {
      await this.desmarcarPredeterminadaDeOtras(tenantId, id);
    }
    return this.db.plantillaHorario.update({ where: { id }, data: dto, include: { dias: { orderBy: { diaSemana: 'asc' } } } });
  }

  /** Como mucho una PlantillaHorario por tenant debería ser predeterminada — mismo criterio que FormasPagoRepository.desmarcarEfectivoDeOtras. */
  desmarcarPredeterminadaDeOtras(tenantId: string, exceptoId?: string) {
    return this.db.plantillaHorario.updateMany({
      where: { tenantId, predeterminada: true, ...(exceptoId ? { id: { not: exceptoId } } : {}) },
      data: { predeterminada: false },
    });
  }

  /** Borra las 7 filas posibles y crea las nuevas — mismo patrón que HorariosRepository.reemplazar. */
  reemplazarDias(plantillaId: string, dias: { diaSemana: DiaSemana; horaEntrada: string; horaSalida: string }[]) {
    return this.db.$transaction(async (tx) => {
      await tx.plantillaHorarioDia.deleteMany({ where: { plantillaId } });
      if (dias.length) {
        await tx.plantillaHorarioDia.createMany({
          data: dias.map((d) => ({ plantillaId, diaSemana: d.diaSemana, horaEntrada: d.horaEntrada, horaSalida: d.horaSalida })),
        });
      }
      return tx.plantillaHorarioDia.findMany({ where: { plantillaId }, orderBy: { diaSemana: 'asc' } });
    });
  }

  /**
   * Horario EFECTIVO de un empleado (plan de integración Cuadre, ítem
   * G-1) — usado por AsistenciaService para tardanza/horas extra: si el
   * empleado tiene una plantilla asignada, sus días GANAN (referencia
   * viva — editar la plantilla cambia esto para todos los asignados) por
   * sobre cualquier `HorarioEmpleado` individual que pudiera quedar de
   * antes de asignarle la plantilla.
   */
  async resolverDiasEfectivos(empleadoId: string) {
    const empleado = await this.db.empleado.findUnique({ where: { id: empleadoId }, select: { plantillaHorarioId: true } });
    if (empleado?.plantillaHorarioId) {
      return this.db.plantillaHorarioDia.findMany({ where: { plantillaId: empleado.plantillaHorarioId } });
    }
    return this.db.horarioEmpleado.findMany({ where: { empleadoId } });
  }
}
