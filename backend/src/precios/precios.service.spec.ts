import { PreciosService } from './precios.service';
import { PreciosRepository } from './precios.repository';
import { ProductosService } from '../productos/productos.service';
import { VariantesService } from '../variantes/variantes.service';

describe('PreciosService', () => {
  let service: PreciosService;
  let repository: jest.Mocked<PreciosRepository>;
  let productosService: jest.Mocked<ProductosService>;
  let variantesService: jest.Mocked<VariantesService>;

  beforeEach(() => {
    repository = { crear: jest.fn(), vigente: jest.fn(), historial: jest.fn() } as unknown as jest.Mocked<PreciosRepository>;
    productosService = { buscarPorId: jest.fn().mockResolvedValue({ id: 'p1' }) } as unknown as jest.Mocked<ProductosService>;
    variantesService = {
      resolverObligatoria: jest.fn().mockResolvedValue('variante-1'),
    } as unknown as jest.Mocked<VariantesService>;
    service = new PreciosService(repository, productosService, variantesService);
  });

  it('calcula precioVenta a partir de costo + margenPct cuando no se da precioVenta', async () => {
    await service.crear({ productoId: 'p1', costo: 100, margenPct: 50 });

    expect(repository.crear).toHaveBeenCalledWith(
      expect.objectContaining({ varianteId: 'variante-1', listaPrecio: 'GENERAL', costo: 100, margenPct: 50, precioVenta: 150 }),
    );
  });

  it('calcula margenPct a partir de costo + precioVenta cuando no se da margenPct', async () => {
    await service.crear({ productoId: 'p1', costo: 100, precioVenta: 130 });

    expect(repository.crear).toHaveBeenCalledWith(
      expect.objectContaining({ costo: 100, precioVenta: 130, margenPct: 30 }),
    );
  });

  it('usa GENERAL como listaPrecio por defecto', async () => {
    await service.crear({ productoId: 'p1', costo: 100, margenPct: 20 });
    expect(repository.crear).toHaveBeenCalledWith(expect.objectContaining({ listaPrecio: 'GENERAL' }));
  });

  it('respeta la listaPrecio explícita', async () => {
    await service.crear({ productoId: 'p1', costo: 100, margenPct: 20, listaPrecio: 'MAYORISTA' });
    expect(repository.crear).toHaveBeenCalledWith(expect.objectContaining({ listaPrecio: 'MAYORISTA' }));
  });

  it('sin margenPct ni precioVenta, el precio de venta queda igual al costo (margen 0)', async () => {
    await service.crear({ productoId: 'p1', costo: 100 });
    expect(repository.crear).toHaveBeenCalledWith(expect.objectContaining({ precioVenta: 100, margenPct: 0 }));
  });

  it('resuelve la variante (obligatoria si el producto tiene más de una) antes de crear el precio', async () => {
    await service.crear({ productoId: 'p1', varianteId: 'variante-elegida', costo: 100, margenPct: 20 });
    expect(variantesService.resolverObligatoria).toHaveBeenCalledWith('p1', 'variante-elegida');
  });

  it('delega vigente() e historial() al repositorio usando la variante resuelta', async () => {
    await service.vigente('p1', undefined, 'MAYORISTA');
    expect(repository.vigente).toHaveBeenCalledWith('variante-1', 'MAYORISTA');

    await service.historial('p1');
    expect(repository.historial).toHaveBeenCalledWith('variante-1', undefined);
  });

  describe('aislamiento de tenant (Precio no tiene tenantId propio)', () => {
    it('vigente() rechaza si el producto no pertenece al tenant actual', async () => {
      productosService.buscarPorId.mockRejectedValue(new Error('No encontrado'));

      await expect(service.vigente('ajeno')).rejects.toThrow('No encontrado');
      expect(repository.vigente).not.toHaveBeenCalled();
    });

    it('crear() rechaza si el producto no pertenece al tenant actual', async () => {
      productosService.buscarPorId.mockRejectedValue(new Error('No encontrado'));

      await expect(service.crear({ productoId: 'ajeno', costo: 100, margenPct: 20 })).rejects.toThrow('No encontrado');
      expect(repository.crear).not.toHaveBeenCalled();
    });
  });
});
