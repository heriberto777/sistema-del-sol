import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EmpleadosService } from './empleados.service';
import { EmpleadosRepository } from './empleados.repository';

describe('EmpleadosService', () => {
  let service: EmpleadosService;
  let repository: jest.Mocked<EmpleadosRepository>;

  beforeEach(() => {
    repository = {
      crear: jest.fn(),
      buscarPorId: jest.fn(),
      listar: jest.fn(),
      listarActivos: jest.fn(),
      actualizar: jest.fn(),
    } as unknown as jest.Mocked<EmpleadosRepository>;
    service = new EmpleadosService(repository);
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
});
