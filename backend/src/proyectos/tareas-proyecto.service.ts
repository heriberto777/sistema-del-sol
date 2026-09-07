import { BadRequestException, Injectable } from '@nestjs/common';
import { ProyectosRepository } from './proyectos.repository';
import { ProyectosService } from './proyectos.service';
import { EmpleadosRepository } from '../nomina/empleados.repository';
import { CrearTareaProyectoDto } from './dto/crear-tarea-proyecto.dto';
import { CrearRegistroHoraDto } from './dto/crear-registro-hora.dto';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';

@Injectable()
export class TareasProyectoService {
  constructor(
    private readonly proyectosRepository: ProyectosRepository,
    private readonly proyectosService: ProyectosService,
    private readonly empleadosRepository: EmpleadosRepository,
    private readonly eventBus: EventBusService,
  ) {}

  async crear(proyectoId: string, dto: CrearTareaProyectoDto, tenantId: string) {
    await this.proyectosService.buscarPorId(proyectoId); // 404 si el proyecto no es de este tenant
    if (dto.hitoId) await this.validarHitoDelProyecto(dto.hitoId, proyectoId);
    return this.proyectosRepository.crearTarea(proyectoId, dto, tenantId);
  }

  buscarPorId(id: string) {
    return this.proyectosRepository.buscarTareaPorId(id);
  }

  async actualizar(id: string, dto: Partial<CrearTareaProyectoDto>) {
    if (dto.hitoId) {
      const tarea = await this.proyectosRepository.buscarTareaPorId(id);
      await this.validarHitoDelProyecto(dto.hitoId, tarea.proyectoId);
    }
    return this.proyectosRepository.actualizarTarea(id, dto);
  }

  async eliminar(id: string) {
    await this.proyectosRepository.buscarTareaPorId(id);
    return this.proyectosRepository.eliminarTarea(id);
  }

  // ---------- Responsables ----------

  async asignarResponsable(tareaId: string, empleadoId: string) {
    await this.proyectosRepository.buscarTareaPorId(tareaId); // 404 si la tarea no es de este tenant
    await this.empleadosRepository.buscarPorId(empleadoId); // 404 si el empleado no es de este tenant
    return this.proyectosRepository.asignarResponsable(tareaId, empleadoId);
  }

  async quitarResponsable(tareaId: string, empleadoId: string) {
    await this.proyectosRepository.buscarTareaPorId(tareaId);
    return this.proyectosRepository.quitarResponsable(tareaId, empleadoId);
  }

  // ---------- Registro de horas ----------

  async registrarHora(tareaId: string, dto: CrearRegistroHoraDto, tenantId: string) {
    const tarea = await this.proyectosRepository.buscarTareaPorId(tareaId);
    await this.empleadosRepository.buscarPorId(dto.empleadoId);
    const registro = await this.proyectosRepository.crearRegistroHora(tareaId, dto, tenantId);
    // Dispara la verificación de presupuesto superado en PresupuestoProyectoListener.
    this.eventBus.emit(EVENTOS.HORAS_PROYECTO_REGISTRADAS, { tenantId, proyectoId: tarea.proyectoId });
    return registro;
  }

  async eliminarRegistroHora(id: string) {
    await this.proyectosRepository.buscarRegistroHoraPorId(id);
    return this.proyectosRepository.eliminarRegistroHora(id);
  }

  /** Un hito de OTRO proyecto no se puede asignar acá — mismo criterio de IDOR que el resto de FKs suministradas por el cliente. */
  private async validarHitoDelProyecto(hitoId: string, proyectoId: string) {
    const hito = await this.proyectosRepository.buscarHitoPorId(hitoId);
    if (hito.proyectoId !== proyectoId) {
      throw new BadRequestException('El hito no pertenece a este proyecto');
    }
  }
}
