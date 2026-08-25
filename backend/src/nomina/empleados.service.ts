import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EmpleadosRepository } from './empleados.repository';
import { PuestosRepository } from '../puestos/puestos.repository';
import { PlantillasHorarioRepository } from '../plantillas-horario/plantillas-horario.repository';
import { CrearEmpleadoDto } from './dto/crear-empleado.dto';
import { ActualizarEmpleadoDto } from './dto/actualizar-empleado.dto';
import { ListarEmpleadosQueryDto } from './dto/listar-empleados-query.dto';
import { paginar } from '../common/types/pagina-resultado';

@Injectable()
export class EmpleadosService {
  constructor(
    private readonly empleadosRepository: EmpleadosRepository,
    private readonly puestosRepository: PuestosRepository,
    private readonly plantillasHorarioRepository: PlantillasHorarioRepository,
  ) {}

  async crear(dto: CrearEmpleadoDto, tenantId: string) {
    // findUniqueOrThrow tenant-scoped: si puestoId es de otro tenant, 404 —
    // mismo patrón de prevención de IDOR ya documentado para FKs cliente-suministradas.
    if (dto.puestoId) {
      await this.puestosRepository.buscarPorId(dto.puestoId);
    }
    if (dto.plantillaHorarioId) {
      await this.plantillasHorarioRepository.buscarPorId(dto.plantillaHorarioId);
    }
    // Plan de integración Cuadre, ítem G-1 — "horario predeterminado para
    // nuevos empleados": si no viene una plantilla explícita, auto-asigna
    // la marcada `predeterminada` (si existe alguna) — referencia viva,
    // igual que una asignación manual.
    const plantillaHorarioId = dto.plantillaHorarioId ?? (await this.plantillasHorarioRepository.buscarPredeterminada())?.id;
    try {
      return await this.empleadosRepository.crear({
        tenantId,
        nombre: dto.nombre,
        cedula: dto.cedula,
        cargo: dto.cargo,
        puestoId: dto.puestoId,
        plantillaHorarioId,
        departamento: dto.departamento,
        fechaIngreso: new Date(dto.fechaIngreso),
        salarioBrutoMensual: dto.salarioBrutoMensual,
        tipoContrato: dto.tipoContrato,
        email: dto.email,
        telefono: dto.telefono,
        userId: dto.userId,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const campo = (error.meta?.target as string[] | undefined)?.join(',') ?? '';
        if (campo.includes('userId')) {
          throw new BadRequestException('Ese usuario ya está vinculado a otro empleado');
        }
        throw new BadRequestException('Ya existe otro empleado con esa cédula');
      }
      throw error;
    }
  }

  buscarPorId(id: string) {
    return this.empleadosRepository.buscarPorId(id);
  }

  async listar(query: ListarEmpleadosQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.empleadosRepository.listar({ skip, take, busqueda: query.busqueda, puestoId: query.puestoId });
    return { datos, total, pagina, tamanoPagina };
  }

  async actualizar(id: string, dto: ActualizarEmpleadoDto) {
    if (dto.puestoId) {
      await this.puestosRepository.buscarPorId(dto.puestoId);
    }
    if (dto.plantillaHorarioId) {
      await this.plantillasHorarioRepository.buscarPorId(dto.plantillaHorarioId);
    }
    try {
      return await this.empleadosRepository.actualizar(id, {
        nombre: dto.nombre,
        cedula: dto.cedula,
        cargo: dto.cargo,
        puestoId: dto.puestoId,
        plantillaHorarioId: dto.plantillaHorarioId,
        departamento: dto.departamento,
        fechaIngreso: dto.fechaIngreso ? new Date(dto.fechaIngreso) : undefined,
        salarioBrutoMensual: dto.salarioBrutoMensual,
        tipoContrato: dto.tipoContrato,
        email: dto.email,
        telefono: dto.telefono,
        activo: dto.fechaSalida ? false : dto.activo,
        fechaSalida: dto.fechaSalida ? new Date(dto.fechaSalida) : undefined,
        userId: dto.userId,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const campo = (error.meta?.target as string[] | undefined)?.join(',') ?? '';
        if (campo.includes('userId')) {
          throw new BadRequestException('Ese usuario ya está vinculado a otro empleado');
        }
        throw new BadRequestException('Ya existe otro empleado con esa cédula');
      }
      throw error;
    }
  }
}
