import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EmpleadosService } from './empleados.service';
import { EmpleadosRepository } from './empleados.repository';
import { PuestosRepository } from '../puestos/puestos.repository';
import { PlantillasHorarioRepository } from '../plantillas-horario/plantillas-horario.repository';

describe('EmpleadosService', () => {
  let service: EmpleadosService;
  let repository: jest.Mocked<EmpleadosRepository>;
  let puestosRepository: jest.Mocked<PuestosRepository>;
  let plantillasHorarioRepository: jest.Mocked<PlantillasHorarioRepository>;

  beforeEach(() => {
    repository = {
      crear: jest.fn(),
      buscarPorId: jest.fn(),
      listar: jest.fn(),
      listarActivos: jest.fn(),
      actualizar: jest.fn(),
    } as unknown as jest.Mocked<EmpleadosRepository>;
    puestosRepository = { buscarPorId: jest.fn() } as unknown as jest.Mocked<PuestosRepository>;
    plantillasHorarioRepository = {
      buscarPorId: jest.fn(),
      buscarPredeterminada: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<PlantillasHorarioRepository>;
    service = new EmpleadosService(repository, puestosRepository, plantillasHorarioRepository);
  });

  it('crear pasa fechaIngreso como Date y el tenantId', async () => {
    repository.crear.mockResolvedValue({ id: 'e1' } as never);

    await service.crear(
      { nombre: 'Juan Pérez', cedula: '001-1', cargo: 'Vendedor', fechaIngreso: '2024-01-01', salarioBrutoMensual: 30000 },
      't1',
    );

    expect(repository.crear).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 't1', fechaIngreso: new Date('2024-01-01') }));
  });

  it('actualizar con fechaSalida fuerza activo=false', async () => {
    repository.actualizar.mockResolvedValue({ id: 'e1' } as never);

    await service.actualizar('e1', { fechaSalida: '2026-01-01' });

    expect(repository.actualizar).toHaveBeenCalledWith('e1', expect.objectContaining({ activo: false, fechaSalida: new Date('2026-01-01') }));
  });

  it('actualizar permite editar nombre, cedula, email y demás campos antes bloqueados', async () => {
    repository.actualizar.mockResolvedValue({ id: 'e1' } as never);

    await service.actualizar('e1', { nombre: 'Juan A. Pérez', cedula: '001-2', email: 'juan@test.com', tipoContrato: 'DETERMINADO' });

    expect(repository.actualizar).toHaveBeenCalledWith(
      'e1',
      expect.objectContaining({ nombre: 'Juan A. Pérez', cedula: '001-2', email: 'juan@test.com', tipoContrato: 'DETERMINADO' }),
    );
  });

  it('rechaza con 400 si la cédula editada ya la tiene otro empleado (violación de índice único)', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('duplicado', { code: 'P2002', clientVersion: 'x' });
    repository.actualizar.mockRejectedValue(error);

    await expect(service.actualizar('e1', { cedula: '001-1' })).rejects.toThrow(BadRequestException);
  });

  it('rechaza con 400 con mensaje distinto si el userId ya lo tiene otro empleado vinculado', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('duplicado', {
      code: 'P2002',
      clientVersion: 'x',
      meta: { target: ['tenantId', 'userId'] },
    });
    repository.actualizar.mockRejectedValue(error);

    await expect(service.actualizar('e1', { userId: 'u1' })).rejects.toThrow('Ese usuario ya está vinculado a otro empleado');
  });

  it('listar pagina con los defaults', async () => {
    repository.listar.mockResolvedValue([[{ id: 'e1' }], 1] as never);

    const resultado = await service.listar({});

    expect(resultado).toEqual({ datos: [{ id: 'e1' }], total: 1, pagina: 1, tamanoPagina: 20 });
  });

  describe('puestoId (plan de integración Cuadre, ítem G-8)', () => {
    it('crear valida que puestoId pertenezca al tenant antes de crear (404 si no, vía findUniqueOrThrow tenant-scoped)', async () => {
      puestosRepository.buscarPorId.mockResolvedValue({ id: 'puesto-1' } as never);
      repository.crear.mockResolvedValue({ id: 'e1' } as never);

      await service.crear(
        { nombre: 'Juan Pérez', cedula: '001-1', cargo: 'Vendedor', puestoId: 'puesto-1', fechaIngreso: '2024-01-01', salarioBrutoMensual: 30000 },
        't1',
      );

      expect(puestosRepository.buscarPorId).toHaveBeenCalledWith('puesto-1');
      expect(repository.crear).toHaveBeenCalledWith(expect.objectContaining({ puestoId: 'puesto-1' }));
    });

    it('actualizar valida puestoId antes de guardar', async () => {
      puestosRepository.buscarPorId.mockResolvedValue({ id: 'puesto-1' } as never);
      repository.actualizar.mockResolvedValue({ id: 'e1' } as never);

      await service.actualizar('e1', { puestoId: 'puesto-1' });

      expect(puestosRepository.buscarPorId).toHaveBeenCalledWith('puesto-1');
      expect(repository.actualizar).toHaveBeenCalledWith('e1', expect.objectContaining({ puestoId: 'puesto-1' }));
    });

    it('listar propaga el filtro puestoId al repositorio', async () => {
      repository.listar.mockResolvedValue([[], 0] as never);

      await service.listar({ puestoId: 'puesto-1' });

      expect(repository.listar).toHaveBeenCalledWith(expect.objectContaining({ puestoId: 'puesto-1' }));
    });
  });

  describe('plantillaHorarioId (plan de integración Cuadre, ítem G-1)', () => {
    it('crear valida que plantillaHorarioId pertenezca al tenant antes de crear', async () => {
      plantillasHorarioRepository.buscarPorId.mockResolvedValue({ id: 'plantilla-1' } as never);
      repository.crear.mockResolvedValue({ id: 'e1' } as never);

      await service.crear(
        { nombre: 'Juan Pérez', cedula: '001-1', cargo: 'Vendedor', plantillaHorarioId: 'plantilla-1', fechaIngreso: '2024-01-01', salarioBrutoMensual: 30000 },
        't1',
      );

      expect(plantillasHorarioRepository.buscarPorId).toHaveBeenCalledWith('plantilla-1');
      expect(repository.crear).toHaveBeenCalledWith(expect.objectContaining({ plantillaHorarioId: 'plantilla-1' }));
    });

    it('auto-asigna la plantilla predeterminada del tenant si no viene una explícita', async () => {
      plantillasHorarioRepository.buscarPredeterminada.mockResolvedValue({ id: 'plantilla-default' } as never);
      repository.crear.mockResolvedValue({ id: 'e1' } as never);

      await service.crear({ nombre: 'Juan Pérez', cedula: '001-1', cargo: 'Vendedor', fechaIngreso: '2024-01-01', salarioBrutoMensual: 30000 }, 't1');

      expect(repository.crear).toHaveBeenCalledWith(expect.objectContaining({ plantillaHorarioId: 'plantilla-default' }));
    });

    it('no auto-asigna si ya viene una plantillaHorarioId explícita', async () => {
      plantillasHorarioRepository.buscarPorId.mockResolvedValue({ id: 'plantilla-1' } as never);
      repository.crear.mockResolvedValue({ id: 'e1' } as never);

      await service.crear(
        { nombre: 'Juan Pérez', cedula: '001-1', cargo: 'Vendedor', plantillaHorarioId: 'plantilla-1', fechaIngreso: '2024-01-01', salarioBrutoMensual: 30000 },
        't1',
      );

      expect(plantillasHorarioRepository.buscarPredeterminada).not.toHaveBeenCalled();
      expect(repository.crear).toHaveBeenCalledWith(expect.objectContaining({ plantillaHorarioId: 'plantilla-1' }));
    });

    it('queda undefined si no hay plantilla explícita ni predeterminada en el tenant', async () => {
      repository.crear.mockResolvedValue({ id: 'e1' } as never);

      await service.crear({ nombre: 'Juan Pérez', cedula: '001-1', cargo: 'Vendedor', fechaIngreso: '2024-01-01', salarioBrutoMensual: 30000 }, 't1');

      expect(repository.crear).toHaveBeenCalledWith(expect.objectContaining({ plantillaHorarioId: undefined }));
    });

    it('actualizar valida plantillaHorarioId antes de guardar', async () => {
      plantillasHorarioRepository.buscarPorId.mockResolvedValue({ id: 'plantilla-1' } as never);
      repository.actualizar.mockResolvedValue({ id: 'e1' } as never);

      await service.actualizar('e1', { plantillaHorarioId: 'plantilla-1' });

      expect(plantillasHorarioRepository.buscarPorId).toHaveBeenCalledWith('plantilla-1');
      expect(repository.actualizar).toHaveBeenCalledWith('e1', expect.objectContaining({ plantillaHorarioId: 'plantilla-1' }));
    });
  });
});
