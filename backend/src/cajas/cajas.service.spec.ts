import { BadRequestException } from '@nestjs/common';
import { CajasService } from './cajas.service';
import { CajasRepository } from './cajas.repository';

describe('CajasService', () => {
  let service: CajasService;
  let repository: jest.Mocked<CajasRepository>;

  beforeEach(() => {
    repository = {
      crear: jest.fn(),
      listar: jest.fn(),
      buscarPorId: jest.fn(),
      buscarRestriccion: jest.fn(),
      productosInfo: jest.fn(),
      actualizar: jest.fn(),
      eliminar: jest.fn(),
    } as unknown as jest.Mocked<CajasRepository>;
    service = new CajasService(repository);
  });

  describe('validarLineasPermitidas (ítem E-7)', () => {
    it('sin categorías ni productos asignados a la Caja, no rechaza nada (vende todo el catálogo)', async () => {
      repository.buscarRestriccion.mockResolvedValue({ categorias: [], productos: [] } as never);

      await service.validarLineasPermitidas('caja-1', ['p1', 'p2']);

      expect(repository.productosInfo).not.toHaveBeenCalled();
    });

    it('permite un producto que está en la lista blanca de productos puntuales', async () => {
      repository.buscarRestriccion.mockResolvedValue({ categorias: [], productos: [{ productoId: 'p1' }] } as never);
      repository.productosInfo.mockResolvedValue([{ id: 'p1', nombre: 'Producto 1', categoriaId: null }] as never);

      await expect(service.validarLineasPermitidas('caja-1', ['p1'])).resolves.toBeUndefined();
    });

    it('permite un producto cuya categoría está en la lista blanca de categorías', async () => {
      repository.buscarRestriccion.mockResolvedValue({ categorias: [{ categoriaId: 'cat-1' }], productos: [] } as never);
      repository.productosInfo.mockResolvedValue([{ id: 'p1', nombre: 'Producto 1', categoriaId: 'cat-1' }] as never);

      await expect(service.validarLineasPermitidas('caja-1', ['p1'])).resolves.toBeUndefined();
    });

    it('rechaza un producto que no está en ninguna de las dos listas', async () => {
      repository.buscarRestriccion.mockResolvedValue({ categorias: [{ categoriaId: 'cat-1' }], productos: [{ productoId: 'p9' }] } as never);
      repository.productosInfo.mockResolvedValue([{ id: 'p1', nombre: 'Producto Prohibido', categoriaId: 'cat-2' }] as never);

      await expect(service.validarLineasPermitidas('caja-1', ['p1'])).rejects.toThrow(BadRequestException);
    });

    it('rechaza un producto sin categoría cuando solo hay restricción de categorías (no de productos puntuales)', async () => {
      repository.buscarRestriccion.mockResolvedValue({ categorias: [{ categoriaId: 'cat-1' }], productos: [] } as never);
      repository.productosInfo.mockResolvedValue([{ id: 'p1', nombre: 'Producto Sin Categoría', categoriaId: null }] as never);

      await expect(service.validarLineasPermitidas('caja-1', ['p1'])).rejects.toThrow(BadRequestException);
    });
  });
});
