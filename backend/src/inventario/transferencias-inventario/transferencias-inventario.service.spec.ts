import { BadRequestException } from '@nestjs/common';
import { TransferenciasInventarioService } from './transferencias-inventario.service';
import { TransferenciasInventarioRepository } from './transferencias-inventario.repository';
import { InventarioService } from '../inventario.service';
import { VariantesService } from '../../variantes/variantes.service';
import { CorrelativosRepository } from '../../correlativos/correlativos.repository';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';

describe('TransferenciasInventarioService', () => {
  let service: TransferenciasInventarioService;
  let repository: jest.Mocked<TransferenciasInventarioRepository>;
  let inventarioService: jest.Mocked<InventarioService>;
  let variantesService: jest.Mocked<VariantesService>;
  let correlativosRepository: jest.Mocked<CorrelativosRepository>;
  let tenantPrisma: { client: { $transaction: jest.Mock } };

  const TX = { esTransaccion: true };

  beforeEach(() => {
    repository = {
      crearEnTx: jest.fn(),
      buscarPorId: jest.fn(),
      listar: jest.fn().mockResolvedValue([[], 0]),
      actualizar: jest.fn(),
      actualizarEstado: jest.fn(),
    } as unknown as jest.Mocked<TransferenciasInventarioRepository>;
    inventarioService = {
      validarAccesoBodega: jest.fn().mockResolvedValue({ id: 'bodega-1', sucursalId: 's1' }),
      transferirStockEnTx: jest.fn(),
    } as unknown as jest.Mocked<InventarioService>;
    variantesService = { resolverObligatoria: jest.fn().mockResolvedValue('variante-1') } as unknown as jest.Mocked<VariantesService>;
    correlativosRepository = { siguienteEnTx: jest.fn().mockResolvedValue('TR-00001') } as unknown as jest.Mocked<CorrelativosRepository>;
    tenantPrisma = { client: { $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(TX)) } };

    service = new TransferenciasInventarioService(
      repository,
      inventarioService,
      variantesService,
      correlativosRepository,
      tenantPrisma as unknown as TenantPrismaService,
    );
  });

  describe('crear', () => {
    it('valida acceso a AMBAS bodegas (Fase 9) y crea la transferencia en BORRADOR sin tocar stock', async () => {
      await service.crear(
        { bodegaOrigenId: 'bodega-1', bodegaDestinoId: 'bodega-2', lineas: [{ productoId: 'p1', cantidad: 5 }] } as never,
        'tenant-1',
        'user-1',
      );

      expect(inventarioService.validarAccesoBodega).toHaveBeenCalledWith('bodega-1', 'user-1');
      expect(inventarioService.validarAccesoBodega).toHaveBeenCalledWith('bodega-2', 'user-1');
      expect(inventarioService.transferirStockEnTx).not.toHaveBeenCalled();
      expect(repository.crearEnTx).toHaveBeenCalledWith(TX, {
        tenantId: 'tenant-1',
        numero: 'TR-00001',
        bodegaOrigenId: 'bodega-1',
        bodegaDestinoId: 'bodega-2',
        userId: 'user-1',
        lineas: [{ productoId: 'p1', cantidad: 5, varianteId: 'variante-1' }],
      });
    });
  });

  describe('actualizar', () => {
    it('rechaza editar una transferencia que no está en BORRADOR', async () => {
      repository.buscarPorId.mockResolvedValue({ estado: 'CONFIRMADO' } as never);

      await expect(service.actualizar('t1', { lineas: [] } as never)).rejects.toThrow(BadRequestException);
      expect(repository.actualizar).not.toHaveBeenCalled();
    });

    it('reemplaza las líneas de una transferencia en BORRADOR', async () => {
      repository.buscarPorId.mockResolvedValue({ estado: 'BORRADOR' } as never);

      await service.actualizar('t1', { lineas: [{ productoId: 'p1', cantidad: 7 }] } as never);

      expect(repository.actualizar).toHaveBeenCalledWith('t1', { lineas: [{ productoId: 'p1', cantidad: 7, varianteId: 'variante-1' }] });
    });
  });

  describe('cambiarEstado', () => {
    it('cancela una transferencia en BORRADOR sin tocar stock', async () => {
      repository.buscarPorId.mockResolvedValue({ estado: 'BORRADOR', lineas: [] } as never);

      await service.cambiarEstado('t1', { estado: 'CANCELADO' } as never, 'tenant-1', 'user-1');

      expect(inventarioService.transferirStockEnTx).not.toHaveBeenCalled();
      expect(repository.actualizarEstado).toHaveBeenCalledWith(TX, 't1', 'CANCELADO');
    });

    it('rechaza confirmar/cancelar una transferencia que ya no está en BORRADOR', async () => {
      repository.buscarPorId.mockResolvedValue({ estado: 'CONFIRMADO', lineas: [] } as never);

      await expect(service.cambiarEstado('t1', { estado: 'CONFIRMADO' } as never, 'tenant-1', 'user-1')).rejects.toThrow(BadRequestException);
      await expect(service.cambiarEstado('t1', { estado: 'CANCELADO' } as never, 'tenant-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('confirmar llama transferirStockEnTx una vez por línea, con las bodegas del documento, y marca CONFIRMADO', async () => {
      repository.buscarPorId.mockResolvedValue({
        id: 't1',
        estado: 'BORRADOR',
        bodegaOrigenId: 'bodega-1',
        bodegaDestinoId: 'bodega-2',
        lineas: [
          { productoId: 'p1', varianteId: 'v1', cantidad: 5 },
          { productoId: 'p2', varianteId: 'v2', cantidad: 2 },
        ],
      } as never);

      await service.cambiarEstado('t1', { estado: 'CONFIRMADO' } as never, 'tenant-1', 'user-1');

      expect(inventarioService.transferirStockEnTx).toHaveBeenCalledTimes(2);
      expect(inventarioService.transferirStockEnTx).toHaveBeenNthCalledWith(1, TX, {
        tenantId: 'tenant-1',
        productoId: 'p1',
        varianteId: 'v1',
        bodegaOrigenId: 'bodega-1',
        bodegaDestinoId: 'bodega-2',
        cantidad: 5,
        userId: 'user-1',
      });
      expect(repository.actualizarEstado).toHaveBeenCalledWith(TX, 't1', 'CONFIRMADO');
    });

    it('si transferirStockEnTx rechaza (stock insuficiente), no marca CONFIRMADO', async () => {
      repository.buscarPorId.mockResolvedValue({
        id: 't1',
        estado: 'BORRADOR',
        bodegaOrigenId: 'bodega-1',
        bodegaDestinoId: 'bodega-2',
        lineas: [{ productoId: 'p1', varianteId: 'v1', cantidad: 100 }],
      } as never);
      inventarioService.transferirStockEnTx.mockRejectedValue(new BadRequestException('Stock insuficiente'));

      await expect(service.cambiarEstado('t1', { estado: 'CONFIRMADO' } as never, 'tenant-1', 'user-1')).rejects.toThrow(BadRequestException);
      expect(repository.actualizarEstado).not.toHaveBeenCalled();
    });
  });
});
