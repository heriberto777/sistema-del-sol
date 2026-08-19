import { BadRequestException } from '@nestjs/common';
import { ProductosService } from './productos.service';
import { ProductosRepository } from './productos.repository';
import { CategoriasRepository } from '../categorias/categorias.repository';
import { VariantesService } from '../variantes/variantes.service';

describe('ProductosService', () => {
  let service: ProductosService;
  let repository: jest.Mocked<ProductosRepository>;
  let categoriasRepository: jest.Mocked<CategoriasRepository>;
  let variantesService: jest.Mocked<VariantesService>;

  beforeEach(() => {
    repository = {
      crear: jest.fn(),
      listar: jest.fn(),
      catalogo: jest.fn(),
      buscarPorId: jest.fn(),
      buscarPorIdEnTx: jest.fn(),
      actualizar: jest.fn(),
    } as unknown as jest.Mocked<ProductosRepository>;
    categoriasRepository = {
      buscarPorId: jest.fn().mockResolvedValue({ id: 'cat-1' }),
    } as unknown as jest.Mocked<CategoriasRepository>;
    variantesService = {
      generarCombinaciones: jest.fn(),
      listarPorProducto: jest.fn(),
    } as unknown as jest.Mocked<VariantesService>;
    service = new ProductosService(repository, categoriasRepository, variantesService);
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
      await service.actualizar('p1', { nombre: 'Nuevo nombre' }, 'tenant-1');

      expect(repository.buscarPorId).not.toHaveBeenCalled();
      expect(repository.actualizar).toHaveBeenCalledWith('p1', { nombre: 'Nuevo nombre' });
    });

    it('rechaza un combo que se compone de sí mismo', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'combo-1', tipo: 'COMBO' } as never);

      await expect(
        service.actualizar('combo-1', { componentes: [{ productoId: 'combo-1', cantidad: 1 }] }, 'tenant-1'),
      ).rejects.toThrow(BadRequestException);
      expect(repository.actualizar).not.toHaveBeenCalled();
    });

    it('al cambiar el tipo de COMBO a PRODUCTO, limpia los componentes aunque no se hayan enviado', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'combo-1', tipo: 'COMBO' } as never);

      await service.actualizar('combo-1', { tipo: 'PRODUCTO' }, 'tenant-1');

      expect(repository.actualizar).toHaveBeenCalledWith('combo-1', { tipo: 'PRODUCTO', componentes: [] });
    });

    it('reemplaza los componentes de un combo existente tras validar que ninguno sea otro combo', async () => {
      repository.buscarPorId
        .mockResolvedValueOnce({ id: 'combo-1', tipo: 'COMBO' } as never) // tipo actual
        .mockResolvedValueOnce({ id: 'p2', nombre: 'Componente', tipo: 'PRODUCTO' } as never); // validación del componente

      await service.actualizar('combo-1', { componentes: [{ productoId: 'p2', cantidad: 5 }] }, 'tenant-1');

      expect(repository.actualizar).toHaveBeenCalledWith('combo-1', {
        componentes: [{ productoId: 'p2', cantidad: 5 }],
      });
    });
  });

  describe('catalogo', () => {
    it('aplana precios[0].precioVenta a precioVenta, y null si el producto no tiene precio vigente', async () => {
      repository.catalogo.mockResolvedValue([
        [
          { id: 'p1', codigo: 'A', nombre: 'Con precio', imagen: null, precios: [{ precioVenta: '150' }] },
          { id: 'p2', codigo: 'B', nombre: 'Sin precio', imagen: null, precios: [] },
        ],
        2,
      ] as never);

      const resultado = await service.catalogo({});

      expect(resultado.datos).toEqual([
        { id: 'p1', codigo: 'A', nombre: 'Con precio', imagen: null, precioVenta: '150' },
        { id: 'p2', codigo: 'B', nombre: 'Sin precio', imagen: null, precioVenta: null },
      ]);
      expect(resultado.total).toBe(2);
    });

    it('pasa la categoría al repositorio como filtro del catálogo', async () => {
      repository.catalogo.mockResolvedValue([[], 0] as never);

      await service.catalogo({ categoriaId: 'cat-1' });

      expect(repository.catalogo).toHaveBeenCalledWith(
        expect.objectContaining({ categoriaId: 'cat-1' }),
      );
    });
  });

  describe('categoriaId (FK cliente-suministrada)', () => {
    it('valida que categoriaId pertenezca al tenant antes de crear (404 si no, vía findUniqueOrThrow tenant-scoped)', async () => {
      await service.crear({ codigo: 'P1', nombre: 'Producto 1', categoriaId: 'cat-1' }, 'tenant-1');

      expect(categoriasRepository.buscarPorId).toHaveBeenCalledWith('cat-1');
      expect(repository.crear).toHaveBeenCalled();
    });

    it('no valida categoriaId si no viene en el DTO al crear', async () => {
      await service.crear({ codigo: 'P1', nombre: 'Producto 1' }, 'tenant-1');

      expect(categoriasRepository.buscarPorId).not.toHaveBeenCalled();
    });

    it('valida categoriaId al actualizar', async () => {
      await service.actualizar('p1', { categoriaId: 'cat-1' }, 'tenant-1');

      expect(categoriasRepository.buscarPorId).toHaveBeenCalledWith('cat-1');
      expect(repository.actualizar).toHaveBeenCalledWith('p1', { categoriaId: 'cat-1' });
    });
  });

  describe('atributos (generación de variantes)', () => {
    it('genera combinaciones al actualizar cuando el dto trae atributos', async () => {
      const atributos = [{ atributoId: 'a1', valoresIds: ['v1', 'v2'] }];

      await service.actualizar('p1', { atributos }, 'tenant-1');

      expect(variantesService.generarCombinaciones).toHaveBeenCalledWith('p1', 'tenant-1', atributos);
    });

    it('no toca variantes si el dto no trae el campo atributos', async () => {
      await service.actualizar('p1', { nombre: 'Nuevo nombre' }, 'tenant-1');

      expect(variantesService.generarCombinaciones).not.toHaveBeenCalled();
    });

    it('revierte a la variante por defecto cuando se envía atributos: []', async () => {
      await service.actualizar('p1', { atributos: [] }, 'tenant-1');

      expect(variantesService.generarCombinaciones).toHaveBeenCalledWith('p1', 'tenant-1', []);
    });
  });
});
