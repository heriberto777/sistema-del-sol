import { BadRequestException } from '@nestjs/common';
import { ProductosService } from './productos.service';
import { ProductosRepository } from './productos.repository';

describe('ProductosService', () => {
  let service: ProductosService;
  let repository: jest.Mocked<ProductosRepository>;

  beforeEach(() => {
    repository = {
      crear: jest.fn(),
      listar: jest.fn(),
      buscarPorId: jest.fn(),
      buscarPorIdEnTx: jest.fn(),
      actualizar: jest.fn(),
    } as unknown as jest.Mocked<ProductosRepository>;
    service = new ProductosService(repository);
  });

  describe('crear', () => {
    it('crea un producto normal sin validar nada de componentes', async () => {
      await service.crear({ codigo: 'P1', nombre: 'Producto 1' }, 'tenant-1');
      expect(repository.crear).toHaveBeenCalledWith({ codigo: 'P1', nombre: 'Producto 1' }, 'tenant-1');
    });

    it('rechaza componentes en un producto que no es COMBO', async () => {
      await expect(
        service.crear(
          { codigo: 'P1', nombre: 'Producto 1', tipo: 'PRODUCTO', componentes: [{ productoId: 'p2', cantidad: 1 }] },
          'tenant-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repository.crear).not.toHaveBeenCalled();
    });

    it('rechaza un componente que a su vez es un COMBO (no se permiten combos anidados)', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'p2', nombre: 'Combo Y', tipo: 'COMBO' } as never);

      await expect(
        service.crear(
          { codigo: 'combo-1', nombre: 'Combo 1', tipo: 'COMBO', componentes: [{ productoId: 'p2', cantidad: 1 }] },
          'tenant-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repository.crear).not.toHaveBeenCalled();
    });

    it('crea un COMBO con componentes válidos (PRODUCTO/SERVICIO)', async () => {
      repository.buscarPorId
        .mockResolvedValueOnce({ id: 'p2', nombre: 'Componente físico', tipo: 'PRODUCTO' } as never)
        .mockResolvedValueOnce({ id: 'p3', nombre: 'Componente servicio', tipo: 'SERVICIO' } as never);

      const dto = {
        codigo: 'combo-1',
        nombre: 'Combo 1',
        tipo: 'COMBO' as const,
        componentes: [
          { productoId: 'p2', cantidad: 2 },
          { productoId: 'p3', cantidad: 1 },
        ],
      };
      await service.crear(dto, 'tenant-1');

      expect(repository.crear).toHaveBeenCalledWith(dto, 'tenant-1');
    });
  });

  describe('actualizar', () => {
    it('no valida nada ni consulta el producto actual si no se envía tipo ni componentes', async () => {
      await service.actualizar('p1', { nombre: 'Nuevo nombre' });

      expect(repository.buscarPorId).not.toHaveBeenCalled();
      expect(repository.actualizar).toHaveBeenCalledWith('p1', { nombre: 'Nuevo nombre' });
    });

    it('rechaza un combo que se compone de sí mismo', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'combo-1', tipo: 'COMBO' } as never);

      await expect(
        service.actualizar('combo-1', { componentes: [{ productoId: 'combo-1', cantidad: 1 }] }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.actualizar).not.toHaveBeenCalled();
    });

    it('al cambiar el tipo de COMBO a PRODUCTO, limpia los componentes aunque no se hayan enviado', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'combo-1', tipo: 'COMBO' } as never);

      await service.actualizar('combo-1', { tipo: 'PRODUCTO' });

      expect(repository.actualizar).toHaveBeenCalledWith('combo-1', { tipo: 'PRODUCTO', componentes: [] });
    });

    it('reemplaza los componentes de un combo existente tras validar que ninguno sea otro combo', async () => {
      repository.buscarPorId
        .mockResolvedValueOnce({ id: 'combo-1', tipo: 'COMBO' } as never) // tipo actual
        .mockResolvedValueOnce({ id: 'p2', nombre: 'Componente', tipo: 'PRODUCTO' } as never); // validación del componente

      await service.actualizar('combo-1', { componentes: [{ productoId: 'p2', cantidad: 5 }] });

      expect(repository.actualizar).toHaveBeenCalledWith('combo-1', {
        componentes: [{ productoId: 'p2', cantidad: 5 }],
      });
    });
  });
});
