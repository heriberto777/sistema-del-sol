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
    // Fase 6 — mover la tarjeta a En revisión/Terminada pausa sola
    // cualquier cronómetro que haya quedado corriendo (de cualquier
    // responsable), para no dejar un cronómetro corriendo en una tarea ya
    // cerrada.
    if (dto.estado === 'EN_REVISION' || dto.estado === 'TERMINADA') {
      await this.pausarTodasLasSesionesAbiertas(id);
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

  // ---------- Cronómetro (Fase 6) ----------
  // Diseño confirmado con el usuario: un cronómetro corriendo es siempre de
  // UN empleado — nunca lo inicia/pausa otro en su nombre (eso sigue
  // existiendo vía "registrar hora" manual). Al pausar, se crea el mismo
  // `RegistroHoraProyecto` de siempre — Rentabilidad/costo-por-hito/
  // facturar-hito no necesitan saber que el cronómetro existe.

  async iniciarSesionTrabajo(tareaId: string, userId: string) {
    const tarea = await this.proyectosRepository.buscarTareaPorId(tareaId); // 404 si la tarea no es de este tenant
    const empleado = await this.resolverEmpleadoDeUsuario(userId);
    const esResponsable = tarea.responsables.some((r) => r.empleadoId === empleado.id);
    if (!esResponsable) {
      throw new BadRequestException('Solo un responsable de la tarea puede iniciar su cronómetro.');
    }

    // Un cronómetro a la vez por empleado, en TODO el sistema — si ya tenía
    // uno corriendo en otra tarea, se pausa solo antes de arrancar este.
    const abiertaEnOtraTarea = await this.proyectosRepository.buscarSesionAbiertaDelEmpleado(empleado.id);
    if (abiertaEnOtraTarea) await this.cerrarYRegistrarSesion(abiertaEnOtraTarea);

    return this.proyectosRepository.crearSesionTrabajo(tareaId, empleado.id, tarea.tenantId);
  }

  async pausarSesionTrabajo(tareaId: string, userId: string) {
    const empleado = await this.resolverEmpleadoDeUsuario(userId);
    const abierta = await this.proyectosRepository.buscarSesionAbiertaDeTareaYEmpleado(tareaId, empleado.id);
    if (!abierta) throw new BadRequestException('No tenés un cronómetro corriendo en esta tarea.');
    return this.cerrarYRegistrarSesion(abierta);
  }

  private async resolverEmpleadoDeUsuario(userId: string) {
    const empleado = await this.empleadosRepository.buscarPorUserId(userId);
    if (!empleado) {
      throw new BadRequestException('Tu usuario no tiene un empleado de RRHH vinculado — pedile a un administrador que te asocie primero.');
    }
    return empleado;
  }

  /**
   * Cierra la sesión y crea el `RegistroHoraProyecto` correspondiente. Si
   * quedó corriendo más de 24h (cronómetro olvidado encendido), se recorta
   * a 24h y se deja constancia en la nota — mismo tope que ya valida
   * `CrearRegistroHoraDto.horas` para la carga manual.
   */
  private async cerrarYRegistrarSesion(sesion: { id: string; tareaId: string; empleadoId: string; tenantId: string; inicio: Date }) {
    const fin = new Date();
    await this.proyectosRepository.cerrarSesionTrabajo(sesion.id, fin);

    const horasBrutas = (fin.getTime() - sesion.inicio.getTime()) / 3_600_000;
    const horas = Math.round(Math.min(horasBrutas, 24) * 100) / 100;
    if (horas <= 0) return undefined; // Iniciar/Pausar casi inmediato — nada real que registrar

    const registro = await this.proyectosRepository.crearRegistroHora(
      sesion.tareaId,
      {
        empleadoId: sesion.empleadoId,
        fecha: fin.toISOString(),
        horas,
        nota: horasBrutas > 24 ? `Cronómetro — quedó corriendo ${horasBrutas.toFixed(1)}h, recortado a 24h (revisar)` : 'Cronómetro',
      },
      sesion.tenantId,
    );

    const tarea = await this.proyectosRepository.buscarTareaPorId(sesion.tareaId);
    this.eventBus.emit(EVENTOS.HORAS_PROYECTO_REGISTRADAS, { tenantId: sesion.tenantId, proyectoId: tarea.proyectoId });
    return registro;
  }

  private async pausarTodasLasSesionesAbiertas(tareaId: string) {
    const abiertas = await this.proyectosRepository.buscarSesionesAbiertasDeTarea(tareaId);
    for (const sesion of abiertas) {
      await this.cerrarYRegistrarSesion(sesion);
    }
  }

  /** Un hito de OTRO proyecto no se puede asignar acá — mismo criterio de IDOR que el resto de FKs suministradas por el cliente. */
  private async validarHitoDelProyecto(hitoId: string, proyectoId: string) {
    const hito = await this.proyectosRepository.buscarHitoPorId(hitoId);
    if (hito.proyectoId !== proyectoId) {
      throw new BadRequestException('El hito no pertenece a este proyecto');
    }
  }
}
