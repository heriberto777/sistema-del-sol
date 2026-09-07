import { BadRequestException } from '@nestjs/common';
import { ConteoFisicoService } from './conteo-fisico.service';
import { ConteoFisicoRepository } from './conteo-fisico.repository';
import { InventarioService } from '../inventario.service';
import { AjustesInventarioService } from '../ajustes-inventario/ajustes-inventario.service';
import { CorrelativosRepository } from '../../correlativos/correlativos.repository';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';

describe('ConteoFisicoService', () => {
  let service: ConteoFisicoService;
  let repository: jest.Mocked<ConteoFisicoRepository>;
  let inventarioService: jest.Mocked<InventarioService>;
  let ajustesInventarioService: jest.Mocked<AjustesInventarioService>;
  let correlativosRepository: jest.Mocked<CorrelativosRepository>;
  let tenantPrisma: { client: { $transaction: jest.Mock } };

  const TX = { esTransaccion: true };

  beforeEach(() => {
    repository = {
      buscarAbiertoPorBodega: jest.fn().mockResolvedValue(null),
      todoElStockDeLaBodega: jest.fn(),
      stockDeVariantesEnBodega: jest.fn(),
      crearEnTx: jest.fn(),
      buscarPorId: jest.fn(),
      listar: jest.fn().mockResolvedValue([[], 0]),
      actualizarLinea: jest.fn(),
      marcarAplicado: jest.fn(),
      cancelar: jest.fn(),
    } as unknown as jest.Mocked<ConteoFisicoRepository>;
    inventarioService = { validarAccesoBodega: jest.fn().mockResolvedValue({ id: 'b1', sucursalId: 's1' }) } as unknown as jest.Mocked<InventarioService>;
    ajustesInventarioService = {
      crear: jest.fn().mockResolvedValue({ id: 'aj-1' }),
      cambiarEstado: jest.fn(),
    } as unknown as jest.Mocked<AjustesInventarioService>;
    correlativosRepository = { siguienteEnTx: jest.fn().mockResolvedValue('CF-00001') } as unknown as jest.Mocked<CorrelativosRepository>;
    tenantPrisma = { client: { $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(TX)) } };

    service = new ConteoFisicoService(
      repository,
      inventarioService,
      ajustesInventarioService,
      correlativosRepository,
      tenantPrisma as unknown as TenantPrismaService,
    );
  });

  describe('crear', () => {
    it('alcance TOTAL trae todo el stock de la bodega', async () => {
      repository.todoElStockDeLaBodega.mockResolvedValue([{ productoId: 'p1', varianteId: 'v1', cantidadActual: 10 }]);

      await service.crear({ bodegaId: 'b1', alcance: 'TOTAL' } as never, 't1', 'u1');

      expect(inventarioService.validarAccesoBodega).toHaveBeenCalledWith('b1', 'u1');
      expect(repository.todoElStockDeLaBodega).toHaveBeenCalledWith('b1');
      expect(repository.stockDeVariantesEnBodega).not.toHaveBeenCalled();
      expect(correlativosRepository.siguienteEnTx).toHaveBeenCalledWith(TX, 't1', 'CONTEO_FISICO');
      expect(repository.crearEnTx).toHaveBeenCalledWith(
        TX,
        expect.objectContaining({ tenantId: 't1', numero: 'CF-00001', bodegaId: 'b1', alcance: 'TOTAL', userId: 'u1' }),
      );
    });

    it('alcance SELECCION usa las variantes indicadas', async () => {
      repository.stockDeVariantesEnBodega.mockResolvedValue([{ productoId: 'p1', varianteId: 'v1', cantidadActual: 5 }]);

      await service.crear({ bodegaId: 'b1', alcance: 'SELECCION', varianteIds: ['v1'] } as never, 't1', 'u1');

      expect(repository.stockDeVariantesEnBodega).toHaveBeenCalledWith(['v1'], 'b1');
      expect(repository.todoElStockDeLaBodega).not.toHaveBeenCalled();
    });

    it('rechaza SELECCION sin varianteIds', async () => {
      await expect(service.crear({ bodegaId: 'b1', alcance: 'SELECCION' } as never, 't1', 'u1')).rejects.toThrow(BadRequestException);
      expect(repository.stockDeVariantesEnBodega).not.toHaveBeenCalled();
    });

    it('rechaza si ya hay un conteo ABIERTO para esta bodega', async () => {
      repository.buscarAbiertoPorBodega.mockResolvedValue({ id: 'cf-viejo', numero: 'CF-00000' } as never);

      await expect(service.crear({ bodegaId: 'b1', alcance: 'TOTAL' } as never, 't1', 'u1')).rejects.toThrow(BadRequestException);
      expect(repository.todoElStockDeLaBodega).not.toHaveBeenCalled();
    });

    it('rechaza si no hay ningún producto para contar', async () => {
      repository.todoElStockDeLaBodega.mockResolvedValue([]);

      await expect(service.crear({ bodegaId: 'b1', alcance: 'TOTAL' } as never, 't1', 'u1')).rejects.toThrow(BadRequestException);
      expect(repository.crearEnTx).not.toHaveBeenCalled();
    });
  });

  describe('capturarLinea', () => {
    it('rechaza si el conteo no está ABIERTO', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'cf1', estado: 'APLICADO', lineas: [{ id: 'l1' }] } as never);

      await expect(service.capturarLinea('cf1', 'l1', 8, 'u1')).rejects.toThrow(BadRequestException);
      expect(repository.actualizarLinea).not.toHaveBeenCalled();
    });

    it('rechaza si la línea no pertenece a este conteo (defensa IDOR)', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'cf1', estado: 'ABIERTO', lineas: [{ id: 'otra-linea' }] } as never);

      await expect(service.capturarLinea('cf1', 'l1', 8, 'u1')).rejects.toThrow(BadRequestException);
      expect(repository.actualizarLinea).not.toHaveBeenCalled();
    });

    it('captura la cantidad contada con el usuario que la captura', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'cf1', estado: 'ABIERTO', lineas: [{ id: 'l1' }] } as never);

      await service.capturarLinea('cf1', 'l1', 8, 'u2');

      expect(repository.actualizarLinea).toHaveBeenCalledWith('l1', 8, 'u2');
    });
  });

  describe('aplicar', () => {
    const conteoBase = {
      id: 'cf1',
      estado: 'ABIERTO',
      bodegaId: 'b1',
      lineas: [
        { productoId: 'p1', varianteId: 'v1', cantidadTeorica: 10, cantidadContada: 8 }, // diferencia -2
        { productoId: 'p2', varianteId: 'v2', cantidadTeorica: 5, cantidadContada: 5 }, // sin diferencia
        { productoId: 'p3', varianteId: 'v3', cantidadTeorica: 3, cantidadContada: null }, // no contada
      ],
    };

    it('rechaza si el conteo no está ABIERTO', async () => {
      repository.buscarPorId.mockResolvedValue({ ...conteoBase, estado: 'CANCELADO' } as never);

      await expect(service.aplicar('cf1', 't1', 'u1')).rejects.toThrow(BadRequestException);
      expect(ajustesInventarioService.crear).not.toHaveBeenCalled();
    });

    it('genera un Ajuste solo con las líneas que tuvieron diferencia, motivo CORRECCION_CONTEO', async () => {
      repository.buscarPorId.mockResolvedValue(conteoBase as never);

      await service.aplicar('cf1', 't1', 'u1', '1234');

      expect(ajustesInventarioService.crear).toHaveBeenCalledWith(
        {
          bodegaId: 'b1',
          lineas: [{ productoId: 'p1', varianteId: 'v1', cantidad: -2, motivoAjuste: 'CORRECCION_CONTEO' }],
        },
        't1',
        'u1',
      );
      expect(ajustesInventarioService.cambiarEstado).toHaveBeenCalledWith('aj-1', { estado: 'CONFIRMADO', pin: '1234' }, 't1', 'u1');
      expect(repository.marcarAplicado).toHaveBeenCalledWith('cf1', 'aj-1');
    });

    it('no genera ningún Ajuste si ninguna línea tuvo diferencia real', async () => {
      repository.buscarPorId.mockResolvedValue({
        ...conteoBase,
        lineas: [
          { productoId: 'p1', varianteId: 'v1', cantidadTeorica: 10, cantidadContada: 10 },
          { productoId: 'p2', varianteId: 'v2', cantidadTeorica: 5, cantidadContada: null },
        ],
      } as never);

      await service.aplicar('cf1', 't1', 'u1');

      expect(ajustesInventarioService.crear).not.toHaveBeenCalled();
      expect(ajustesInventarioService.cambiarEstado).not.toHaveBeenCalled();
      expect(repository.marcarAplicado).toHaveBeenCalledWith('cf1', undefined);
    });
  });

  describe('cancelar', () => {
    it('rechaza si el conteo no está ABIERTO', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'cf1', estado: 'APLICADO' } as never);

      await expect(service.cancelar('cf1')).rejects.toThrow(BadRequestException);
      expect(repository.cancelar).not.toHaveBeenCalled();
    });

    it('cancela un conteo ABIERTO', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'cf1', estado: 'ABIERTO' } as never);

      await service.cancelar('cf1');

      expect(repository.cancelar).toHaveBeenCalledWith('cf1');
    });
  });
});
