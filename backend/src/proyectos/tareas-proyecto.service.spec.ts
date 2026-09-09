import { BadRequestException } from '@nestjs/common';
import { TareasProyectoService } from './tareas-proyecto.service';
import { ProyectosRepository } from './proyectos.repository';
import { ProyectosService } from './proyectos.service';
import { EmpleadosRepository } from '../nomina/empleados.repository';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';

describe('TareasProyectoService', () => {
  let service: TareasProyectoService;
  let repository: jest.Mocked<ProyectosRepository>;
  let proyectosService: jest.Mocked<ProyectosService>;
  let empleadosRepository: jest.Mocked<EmpleadosRepository>;
  let eventBus: jest.Mocked<EventBusService>;

  beforeEach(() => {
    repository = {
      crearTarea: jest.fn(),
      buscarHitoPorId: jest.fn(),
      buscarTareaPorId: jest.fn(),
      actualizarTarea: jest.fn(),
      asignarResponsable: jest.fn(),
      quitarResponsable: jest.fn(),
      crearRegistroHora: jest.fn(),
      buscarSesionAbiertaDelEmpleado: jest.fn().mockResolvedValue(null),
      buscarSesionAbiertaDeTareaYEmpleado: jest.fn(),
      buscarSesionesAbiertasDeTarea: jest.fn().mockResolvedValue([]),
      crearSesionTrabajo: jest.fn(),
      cerrarSesionTrabajo: jest.fn(),
    } as unknown as jest.Mocked<ProyectosRepository>;
    proyectosService = { buscarPorId: jest.fn().mockResolvedValue({ id: 'p1' }) } as unknown as jest.Mocked<ProyectosService>;
    empleadosRepository = {
      buscarPorId: jest.fn().mockResolvedValue({ id: 'e1' }),
      buscarPorUserId: jest.fn().mockResolvedValue({ id: 'e1' }),
    } as unknown as jest.Mocked<EmpleadosRepository>;
    eventBus = { emit: jest.fn(), on: jest.fn() } as unknown as jest.Mocked<EventBusService>;
    service = new TareasProyectoService(repository, proyectosService, empleadosRepository, eventBus);
  });

  describe('crear', () => {
    it('valida que el proyecto exista/pertenezca al tenant', async () => {
      await service.crear('p1', { titulo: 'Diseñar mockups' } as never, 't1');
      expect(proyectosService.buscarPorId).toHaveBeenCalledWith('p1');
      expect(repository.crearTarea).toHaveBeenCalled();
    });

    it('rechaza si el hitoId pertenece a OTRO proyecto (prevención de IDOR)', async () => {
      repository.buscarHitoPorId.mockResolvedValue({ id: 'h1', proyectoId: 'otro-proyecto' } as never);
      await expect(service.crear('p1', { titulo: 'x', hitoId: 'h1' } as never, 't1')).rejects.toThrow(BadRequestException);
      expect(repository.crearTarea).not.toHaveBeenCalled();
    });

    it('acepta un hitoId que sí pertenece a este proyecto', async () => {
      repository.buscarHitoPorId.mockResolvedValue({ id: 'h1', proyectoId: 'p1' } as never);
      await service.crear('p1', { titulo: 'x', hitoId: 'h1' } as never, 't1');
      expect(repository.crearTarea).toHaveBeenCalled();
    });
  });

  describe('asignarResponsable', () => {
    it('valida tarea y empleado antes de asignar (ambos tenant-scoped)', async () => {
      repository.buscarTareaPorId.mockResolvedValue({ id: 't1' } as never);
      await service.asignarResponsable('t1', 'e1');
      expect(repository.buscarTareaPorId).toHaveBeenCalledWith('t1');
      expect(empleadosRepository.buscarPorId).toHaveBeenCalledWith('e1');
      expect(repository.asignarResponsable).toHaveBeenCalledWith('t1', 'e1');
    });

    it('asignar dos veces al mismo empleado no duplica (upsert en el repositorio, no error acá)', async () => {
      repository.buscarTareaPorId.mockResolvedValue({ id: 't1' } as never);
      await service.asignarResponsable('t1', 'e1');
      await service.asignarResponsable('t1', 'e1');
      expect(repository.asignarResponsable).toHaveBeenCalledTimes(2);
    });
  });

  describe('registrarHora', () => {
    it('valida tarea y empleado antes de registrar', async () => {
      repository.buscarTareaPorId.mockResolvedValue({ id: 't1', proyectoId: 'p1' } as never);
      const dto = { empleadoId: 'e1', fecha: '2026-09-06', horas: 4 } as never;
      await service.registrarHora('t1', dto, 'tenant1');
      expect(repository.crearRegistroHora).toHaveBeenCalledWith('t1', dto, 'tenant1');
    });

    it('emite HORAS_PROYECTO_REGISTRADAS con el proyectoId de la tarea (dispara la verificación de presupuesto)', async () => {
      repository.buscarTareaPorId.mockResolvedValue({ id: 't1', proyectoId: 'p1' } as never);
      const dto = { empleadoId: 'e1', fecha: '2026-09-06', horas: 4 } as never;
      await service.registrarHora('t1', dto, 'tenant1');
      expect(eventBus.emit).toHaveBeenCalledWith(EVENTOS.HORAS_PROYECTO_REGISTRADAS, { tenantId: 'tenant1', proyectoId: 'p1' });
    });
  });

  describe('actualizar', () => {
    it('al pasar a EN_REVISION, pausa (y registra) cualquier cronómetro abierto de la tarea', async () => {
      repository.buscarSesionesAbiertasDeTarea.mockResolvedValue([
        { id: 's1', tareaId: 't1', empleadoId: 'e1', tenantId: 'tenant1', inicio: new Date(Date.now() - 3_600_000) },
      ] as never);
      repository.buscarTareaPorId.mockResolvedValue({ id: 't1', proyectoId: 'p1' } as never);

      await service.actualizar('t1', { estado: 'EN_REVISION' } as never);

      expect(repository.buscarSesionesAbiertasDeTarea).toHaveBeenCalledWith('t1');
      expect(repository.cerrarSesionTrabajo).toHaveBeenCalledWith('s1', expect.any(Date));
      expect(repository.crearRegistroHora).toHaveBeenCalled();
      expect(repository.actualizarTarea).toHaveBeenCalledWith('t1', { estado: 'EN_REVISION' });
    });

    it('al pasar a TERMINADA también pausa los cronómetros abiertos', async () => {
      repository.buscarSesionesAbiertasDeTarea.mockResolvedValue([
        { id: 's1', tareaId: 't1', empleadoId: 'e1', tenantId: 'tenant1', inicio: new Date(Date.now() - 3_600_000) },
      ] as never);
      repository.buscarTareaPorId.mockResolvedValue({ id: 't1', proyectoId: 'p1' } as never);
      await service.actualizar('t1', { estado: 'TERMINADA' } as never);
      expect(repository.cerrarSesionTrabajo).toHaveBeenCalled();
    });

    it('a PENDIENTE/EN_CURSO no toca los cronómetros', async () => {
      await service.actualizar('t1', { estado: 'EN_CURSO' } as never);
      expect(repository.buscarSesionesAbiertasDeTarea).not.toHaveBeenCalled();
    });

    it('si no hay ningún cronómetro abierto, no crea ningún registro de hora', async () => {
      await service.actualizar('t1', { estado: 'TERMINADA' } as never);
      expect(repository.cerrarSesionTrabajo).not.toHaveBeenCalled();
      expect(repository.crearRegistroHora).not.toHaveBeenCalled();
    });
  });

  describe('cronómetro (Fase 6)', () => {
    describe('iniciarSesionTrabajo', () => {
      it('rechaza si el usuario logueado no tiene un empleado de RRHH vinculado', async () => {
        empleadosRepository.buscarPorUserId.mockResolvedValue(null as never);
        repository.buscarTareaPorId.mockResolvedValue({ id: 't1', tenantId: 'tenant1', responsables: [] } as never);
        await expect(service.iniciarSesionTrabajo('t1', 'u1')).rejects.toThrow('no tiene un empleado de RRHH vinculado');
        expect(repository.crearSesionTrabajo).not.toHaveBeenCalled();
      });

      it('rechaza si el empleado no es responsable de la tarea', async () => {
        repository.buscarTareaPorId.mockResolvedValue({ id: 't1', tenantId: 'tenant1', responsables: [{ empleadoId: 'otro' }] } as never);
        await expect(service.iniciarSesionTrabajo('t1', 'u1')).rejects.toThrow('Solo un responsable');
        expect(repository.crearSesionTrabajo).not.toHaveBeenCalled();
      });

      it('crea la sesión si el empleado es responsable y no tiene otra corriendo', async () => {
        repository.buscarTareaPorId.mockResolvedValue({ id: 't1', tenantId: 'tenant1', responsables: [{ empleadoId: 'e1' }] } as never);
        await service.iniciarSesionTrabajo('t1', 'u1');
        expect(repository.crearSesionTrabajo).toHaveBeenCalledWith('t1', 'e1', 'tenant1');
      });

      it('si ya tenía un cronómetro corriendo en OTRA tarea, lo pausa (y registra) antes de arrancar el nuevo', async () => {
        repository.buscarTareaPorId.mockResolvedValue({ id: 't1', tenantId: 'tenant1', responsables: [{ empleadoId: 'e1' }] } as never);
        repository.buscarSesionAbiertaDelEmpleado.mockResolvedValue({
          id: 's-vieja',
          tareaId: 't-otra',
          empleadoId: 'e1',
          tenantId: 'tenant1',
          inicio: new Date(Date.now() - 3_600_000),
        } as never);

        await service.iniciarSesionTrabajo('t1', 'u1');

        expect(repository.cerrarSesionTrabajo).toHaveBeenCalledWith('s-vieja', expect.any(Date));
        expect(repository.crearRegistroHora).toHaveBeenCalled();
        expect(repository.crearSesionTrabajo).toHaveBeenCalledWith('t1', 'e1', 'tenant1');
      });
    });

    describe('pausarSesionTrabajo', () => {
      it('rechaza si no hay cronómetro corriendo de este empleado en esta tarea', async () => {
        repository.buscarSesionAbiertaDeTareaYEmpleado.mockResolvedValue(null as never);
        await expect(service.pausarSesionTrabajo('t1', 'u1')).rejects.toThrow('No tenés un cronómetro corriendo');
      });

      it('cierra la sesión y registra la hora con el cálculo de tiempo transcurrido', async () => {
        const inicio = new Date('2026-09-09T10:00:00.000Z');
        jest.useFakeTimers().setSystemTime(new Date('2026-09-09T12:30:00.000Z')); // 2.5h después
        repository.buscarSesionAbiertaDeTareaYEmpleado.mockResolvedValue({ id: 's1', tareaId: 't1', empleadoId: 'e1', tenantId: 'tenant1', inicio } as never);
        repository.buscarTareaPorId.mockResolvedValue({ id: 't1', proyectoId: 'p1' } as never);

        await service.pausarSesionTrabajo('t1', 'u1');

        expect(repository.cerrarSesionTrabajo).toHaveBeenCalledWith('s1', new Date('2026-09-09T12:30:00.000Z'));
        expect(repository.crearRegistroHora).toHaveBeenCalledWith(
          't1',
          expect.objectContaining({ empleadoId: 'e1', horas: 2.5 }),
          'tenant1',
        );
        expect(eventBus.emit).toHaveBeenCalledWith(EVENTOS.HORAS_PROYECTO_REGISTRADAS, { tenantId: 'tenant1', proyectoId: 'p1' });
        jest.useRealTimers();
      });

      it('una pausa casi inmediata (menos de 0.01h) no crea ningún registro de hora', async () => {
        const inicio = new Date('2026-09-09T10:00:00.000Z');
        jest.useFakeTimers().setSystemTime(new Date('2026-09-09T10:00:01.000Z')); // 1 segundo después
        repository.buscarSesionAbiertaDeTareaYEmpleado.mockResolvedValue({ id: 's1', tareaId: 't1', empleadoId: 'e1', tenantId: 'tenant1', inicio } as never);

        await service.pausarSesionTrabajo('t1', 'u1');

        expect(repository.cerrarSesionTrabajo).toHaveBeenCalled();
        expect(repository.crearRegistroHora).not.toHaveBeenCalled();
        jest.useRealTimers();
      });

      it('una sesión olvidada corriendo más de 24h se recorta a 24h y lo deja en la nota', async () => {
        const inicio = new Date('2026-09-01T00:00:00.000Z');
        jest.useFakeTimers().setSystemTime(new Date('2026-09-05T00:00:00.000Z')); // 4 días después
        repository.buscarSesionAbiertaDeTareaYEmpleado.mockResolvedValue({ id: 's1', tareaId: 't1', empleadoId: 'e1', tenantId: 'tenant1', inicio } as never);
        repository.buscarTareaPorId.mockResolvedValue({ id: 't1', proyectoId: 'p1' } as never);

        await service.pausarSesionTrabajo('t1', 'u1');

        expect(repository.crearRegistroHora).toHaveBeenCalledWith(
          't1',
          expect.objectContaining({ horas: 24, nota: expect.stringContaining('recortado a 24h') }),
          'tenant1',
        );
        jest.useRealTimers();
      });
    });
  });
});
