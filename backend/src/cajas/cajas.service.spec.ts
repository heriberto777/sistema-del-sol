import { BadRequestException } from '@nestjs/common';
import { CajasService } from './cajas.service';
import { CajasRepository } from './cajas.repository';
import { CorrelativosRepository } from '../correlativos/correlativos.repository';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

describe('CajasService', () => {
  let service: CajasService;
  let repository: jest.Mocked<CajasRepository>;
  let correlativosRepository: jest.Mocked<CorrelativosRepository>;
  let tenantPrisma: jest.Mocked<TenantPrismaService>;

  beforeEach(() => {
    repository = {
      crearEnTx: jest.fn(),
      listar: jest.fn(),
      buscarPorId: jest.fn(),
      buscarRestriccion: jest.fn(),
      productosInfo: jest.fn(),
      actualizar: jest.fn(),
      eliminar: jest.fn(),
    } as unknown as jest.Mocked<CajasRepository>;
    correlativosRepository = { siguienteEnTx: jest.fn().mockResolvedValue('00001') } as unknown as jest.Mocked<CorrelativosRepository>;
    tenantPrisma = {
      client: { $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb('tx-fake')) },
    } as unknown as jest.Mocked<TenantPrismaService>;
    service = new CajasService(repository, correlativosRepository, tenantPrisma);
  });

  describe('crear', () => {
    it('consume el correlativo CAJA dentro de la misma transacción y usa ese código, no uno enviado por el cliente', async () => {
      repository.crearEnTx.mockResolvedValue({ id: 'c1', codigo: '00001' } as never);

      await service.crear({ bodegaId: 'b1', nombre: 'Caja 1' } as never, 't1');

      expect(correlativosRepository.siguienteEnTx).toHaveBeenCalledWith('tx-fake', 't1', 'CAJA');
      expect(repository.crearEnTx).toHaveBeenCalledWith('tx-fake', expect.objectContaining({ bodegaId: 'b1' }), 't1', '00001');
    });
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
