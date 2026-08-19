import { BadRequestException } from '@nestjs/common';
import { ProductosService } from './productos.service';
import { ProductosRepository } from './productos.repository';
import { CategoriasRepository } from '../categorias/categorias.repository';
import { VariantesService } from '../variantes/variantes.service';
import { PreciosRepository } from '../precios/precios.repository';

describe('ProductosService', () => {
  let service: ProductosService;
  let repository: jest.Mocked<ProductosRepository>;
  let categoriasRepository: jest.Mocked<CategoriasRepository>;
  let variantesService: jest.Mocked<VariantesService>;
  let preciosRepository: jest.Mocked<PreciosRepository>;

  beforeEach(() => {
    repository = {
      crear: jest.fn().mockResolvedValue({ id: 'nuevo-1' }),
      listar: jest.fn(),
      catalogo: jest.fn(),
      buscarPorId: jest.fn(),
      buscarPorIdEnTx: jest.fn(),
      actualizar: jest.fn(),
      buscarPorCodigo: jest.fn().mockResolvedValue(null),
      exportarDatos: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<ProductosRepository>;
    categoriasRepository = {
      buscarPorId: jest.fn().mockResolvedValue({ id: 'cat-1' }),
      buscarPorNombre: jest.fn().mockResolvedValue(null),
      crear: jest.fn().mockResolvedValue({ id: 'cat-nueva' }),
    } as unknown as jest.Mocked<CategoriasRepository>;
    variantesService = {
      generarCombinaciones: jest.fn(),
      listarPorProducto: jest.fn(),
      resolverObligatoria: jest.fn().mockResolvedValue('variante-1'),
      actualizarCodigoBarras: jest.fn(),
    } as unknown as jest.Mocked<VariantesService>;
    preciosRepository = {
      crear: jest.fn(),
    } as unknown as jest.Mocked<PreciosRepository>;
    service = new ProductosService(repository, categoriasRepository, variantesService, preciosRepository);
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

  describe('exportar', () => {
    it('agrega precio GENERAL de la variante más antigua, código de barras y stock de todas las variantes', async () => {
      repository.exportarDatos.mockResolvedValue([
        {
          codigo: 'P1',
          nombre: 'Producto 1',
          tipo: 'PRODUCTO',
          unidadMedida: 'UND',
          porcentajeItbis: '18' as never,
          categoria: { nombre: 'Bebidas' },
          variantes: [
            { codigoBarras: '111', precios: [{ precioVenta: '100' as never }], stock: [{ cantidadActual: '5' as never }] },
            { codigoBarras: '222', precios: [{ precioVenta: '999' as never }], stock: [{ cantidadActual: '3' as never }] },
          ],
        },
      ] as never);

      const archivo = await service.exportar();

      expect(archivo.nombreArchivo).toBe('productos.xlsx');
      expect(archivo.buffer.length).toBeGreaterThan(0);
    });
  });

  describe('importar', () => {
    it('crea un producto nuevo cuando el código no existe', async () => {
      const resumen = await service.importar({ productos: [{ codigo: 'NUEVO-1', nombre: 'Producto nuevo' }] }, 'tenant-1');

      expect(repository.crear).toHaveBeenCalledWith(
        expect.objectContaining({ codigo: 'NUEVO-1', nombre: 'Producto nuevo', tipo: 'PRODUCTO' }),
        'tenant-1',
      );
      expect(resumen).toEqual({ creados: 1, actualizados: 0, errores: [] });
    });

    it('actualiza un producto existente por código en vez de crear uno nuevo', async () => {
      repository.buscarPorCodigo.mockResolvedValue({ id: 'existente-1' } as never);

      const resumen = await service.importar({ productos: [{ codigo: 'YA-EXISTE', nombre: 'Nombre nuevo' }] }, 'tenant-1');

      expect(repository.actualizar).toHaveBeenCalledWith('existente-1', expect.objectContaining({ nombre: 'Nombre nuevo' }));
      expect(repository.crear).not.toHaveBeenCalled();
      expect(resumen).toEqual({ creados: 0, actualizados: 1, errores: [] });
    });

    it('resuelve la categoría por nombre y la crea si no existe', async () => {
      await service.importar({ productos: [{ codigo: 'P1', nombre: 'Producto', categoria: 'Nueva categoría' }] }, 'tenant-1');

      expect(categoriasRepository.buscarPorNombre).toHaveBeenCalledWith('Nueva categoría');
      expect(categoriasRepository.crear).toHaveBeenCalledWith({ nombre: 'Nueva categoría' }, 'tenant-1');
      expect(repository.crear).toHaveBeenCalledWith(expect.objectContaining({ categoriaId: 'cat-nueva' }), 'tenant-1');
    });

    it('crea el precio GENERAL (costo = precioVenta, margen 0) cuando la fila trae precioGeneral', async () => {
      await service.importar({ productos: [{ codigo: 'P1', nombre: 'Producto', precioGeneral: 150 }] }, 'tenant-1');

      expect(preciosRepository.crear).toHaveBeenCalledWith({
        varianteId: 'variante-1',
        listaPrecio: 'GENERAL',
        costo: 150,
        margenPct: 0,
        precioVenta: 150,
      });
    });

    it('asigna el código de barras a la variante por defecto cuando la fila lo trae', async () => {
      await service.importar({ productos: [{ codigo: 'P1', nombre: 'Producto', codigoBarras: '7501234567890' }] }, 'tenant-1');

      expect(variantesService.actualizarCodigoBarras).toHaveBeenCalledWith('nuevo-1', 'variante-1', '7501234567890');
    });

    it('una fila que falla no aborta las demás — el error queda en el resumen', async () => {
      repository.crear.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ id: 'ok-1' } as never);

      const resumen = await service.importar(
        { productos: [{ codigo: 'MALA', nombre: 'Falla' }, { codigo: 'BUENA', nombre: 'OK' }] },
        'tenant-1',
      );

      expect(resumen.creados).toBe(1);
      expect(resumen.errores).toEqual([{ codigo: 'MALA', mensaje: 'boom' }]);
    });
  });
});
