import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SucursalesService } from './sucursales.service';
import { SucursalesRepository } from './sucursales.repository';

describe('SucursalesService', () => {
  let service: SucursalesService;
  let repository: jest.Mocked<SucursalesRepository>;

  beforeEach(() => {
    repository = {
      crear: jest.fn(),
      listar: jest.fn(),
      buscarPorId: jest.fn(),
      actualizar: jest.fn(),
      listarAsignadasA: jest.fn(),
      contarAsignadasA: jest.fn(),
    } as unknown as jest.Mocked<SucursalesRepository>;
    service = new SucursalesService(repository);
  });

  it('crear pasa el tenantId y el DTO al repositorio', async () => {
    repository.crear.mockResolvedValue({ id: 's1' } as never);

    await service.crear({ nombre: 'Sucursal Norte', ciudad: 'Santiago' }, 't1');

    expect(repository.crear).toHaveBeenCalledWith('t1', { nombre: 'Sucursal Norte', ciudad: 'Santiago' });
  });

  it('crear rechaza con 400 si ya existe otra sucursal con ese nombre (violación de índice único)', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('duplicado', { code: 'P2002', clientVersion: 'x' });
    repository.crear.mockRejectedValue(error);

    await expect(service.crear({ nombre: 'Sucursal Norte' }, 't1')).rejects.toThrow(BadRequestException);
  });

  it('actualizar rechaza con 400 si el nombre editado ya lo tiene otra sucursal', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('duplicado', { code: 'P2002', clientVersion: 'x' });
    repository.actualizar.mockRejectedValue(error);

    await expect(service.actualizar('s1', { nombre: 'Sucursal Norte' })).rejects.toThrow(BadRequestException);
  });

  it('listar delega en el repositorio', async () => {
    repository.listar.mockResolvedValue([{ id: 's1' }] as never);

    const resultado = await service.listar();

    expect(resultado).toEqual([{ id: 's1' }]);
  });

  it('buscarPorId delega en el repositorio (404 si no pertenece al tenant)', async () => {
    repository.buscarPorId.mockResolvedValue({ id: 's1' } as never);

    await service.buscarPorId('s1');

    expect(repository.buscarPorId).toHaveBeenCalledWith('s1');
  });

  describe('mias', () => {
    it('devuelve todas las sucursales si el usuario no tiene ninguna asignación', async () => {
      repository.contarAsignadasA.mockResolvedValue(0);
      repository.listar.mockResolvedValue([{ id: 's1' }, { id: 's2' }] as never);

      const resultado = await service.mias('u1');

      expect(resultado).toEqual([{ id: 's1' }, { id: 's2' }]);
      expect(repository.listarAsignadasA).not.toHaveBeenCalled();
    });

    it('devuelve solo las asignadas si el usuario tiene al menos una', async () => {
      repository.contarAsignadasA.mockResolvedValue(1);
      repository.listarAsignadasA.mockResolvedValue([{ id: 's1' }] as never);

      const resultado = await service.mias('u1');

      expect(resultado).toEqual([{ id: 's1' }]);
      expect(repository.listar).not.toHaveBeenCalled();
    });
  });
});
