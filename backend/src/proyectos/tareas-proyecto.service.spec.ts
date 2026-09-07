import { BadRequestException } from '@nestjs/common';
import { TareasProyectoService } from './tareas-proyecto.service';
import { ProyectosRepository } from './proyectos.repository';
import { ProyectosService } from './proyectos.service';
import { EmpleadosRepository } from '../nomina/empleados.repository';

describe('TareasProyectoService', () => {
  let service: TareasProyectoService;
  let repository: jest.Mocked<ProyectosRepository>;
  let proyectosService: jest.Mocked<ProyectosService>;
  let empleadosRepository: jest.Mocked<EmpleadosRepository>;

  beforeEach(() => {
    repository = {
      crearTarea: jest.fn(),
      buscarHitoPorId: jest.fn(),
      buscarTareaPorId: jest.fn(),
      asignarResponsable: jest.fn(),
      quitarResponsable: jest.fn(),
      crearRegistroHora: jest.fn(),
    } as unknown as jest.Mocked<ProyectosRepository>;
    proyectosService = { buscarPorId: jest.fn().mockResolvedValue({ id: 'p1' }) } as unknown as jest.Mocked<ProyectosService>;
    empleadosRepository = { buscarPorId: jest.fn().mockResolvedValue({ id: 'e1' }) } as unknown as jest.Mocked<EmpleadosRepository>;
    service = new TareasProyectoService(repository, proyectosService, empleadosRepository);
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
      repository.buscarTareaPorId.mockResolvedValue({ id: 't1' } as never);
      const dto = { empleadoId: 'e1', fecha: '2026-09-06', horas: 4 } as never;
      await service.registrarHora('t1', dto, 'tenant1');
      expect(repository.crearRegistroHora).toHaveBeenCalledWith('t1', dto, 'tenant1');
    });
  });
});
