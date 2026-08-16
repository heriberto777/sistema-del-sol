import { BadRequestException } from '@nestjs/common';
import { InventarioService } from './inventario.service';
import { InventarioRepository } from './inventario.repository';
import { ProductosService } from '../productos/productos.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';

describe('InventarioService', () => {
  let service: InventarioService;
  let repository: jest.Mocked<InventarioRepository>;
  let productosService: jest.Mocked<ProductosService>;
  let eventBus: jest.Mocked<EventBusService>;

  beforeEach(() => {
    repository = {
      obtenerStock: jest.fn(),
      ajustarCantidad: jest.fn(),
      descontarStockCondicional: jest.fn(),
      descontarStockCondicionalEnTx: jest.fn(),
      transferir: jest.fn(),
      listarStockPorBodega: jest.fn(),
      listarBodegas: jest.fn(),
      crearBodega: jest.fn(),
      buscarBodegaPorId: jest.fn().mockResolvedValue({ id: 'b1' }),
    } as unknown as jest.Mocked<InventarioRepository>;
    productosService = { buscarPorId: jest.fn().mockResolvedValue({ id: 'p1' }) } as unknown as jest.Mocked<ProductosService>;
    eventBus = { emit: jest.fn(), on: jest.fn() } as unknown as jest.Mocked<EventBusService>;
    service = new InventarioService(repository, productosService, eventBus);
  });

  describe('verificarYDescontarStock', () => {
    const params = {
      tenantId: 't1',
      productoId: 'p1',
      bodegaId: 'b1',
      cantidad: 5,
      userId: 'u1',
      referencia: 'Venta por factura',
    };

    it('lanza BadRequestException si el UPDATE condicional no afecta ninguna fila (stock insuficiente) y NO descuenta', async () => {
      // El UPDATE atómico devuelve null cuando el WHERE (incluyendo el chequeo de disponible) no matchea —
      // reemplaza el patrón anterior de "leer + decidir en JS" (TOCTOU real, ver ARCHITECTURE.md).
      repository.descontarStockCondicional.mockResolvedValue(null as never);
      repository.obtenerStock.mockResolvedValue({ cantidadActual: 3, cantidadReservada: 0 } as never);

      await expect(service.verificarYDescontarStock(params)).rejects.toThrow(BadRequestException);
      expect(repository.ajustarCantidad).not.toHaveBeenCalled();
    });

    it('descuenta el stock (tipo SALIDA) en una sola llamada atómica cuando hay disponible suficiente', async () => {
      repository.descontarStockCondicional.mockResolvedValue({ cantidadActual: 15, stockMinimo: 5 } as never);

      await service.verificarYDescontarStock(params);

      expect(repository.descontarStockCondicional).toHaveBeenCalledWith({
        tenantId: 't1',
        productoId: 'p1',
        bodegaId: 'b1',
        cantidad: 5,
        tipo: 'SALIDA',
        userId: 'u1',
        motivo: 'Venta por factura',
      });
    });

    it('emite STOCK_BAJO cuando el resultado queda por debajo del mínimo', async () => {
      repository.descontarStockCondicional.mockResolvedValue({ cantidadActual: 3, stockMinimo: 10 } as never);

      await service.verificarYDescontarStock(params);

      expect(eventBus.emit).toHaveBeenCalledWith(
        EVENTOS.STOCK_BAJO,
        expect.objectContaining({ tenantId: 't1', productoId: 'p1', bodegaId: 'b1' }),
      );
    });

    it('NO emite STOCK_BAJO cuando el resultado queda por encima del mínimo', async () => {
      repository.descontarStockCondicional.mockResolvedValue({ cantidadActual: 50, stockMinimo: 10 } as never);

      await service.verificarYDescontarStock(params);

      expect(eventBus.emit).not.toHaveBeenCalled();
    });

    it('trata un stock inexistente (producto nunca cargado en esa bodega) igual que uno insuficiente', async () => {
      repository.descontarStockCondicional.mockResolvedValue(null as never);
      repository.obtenerStock.mockResolvedValue(null);

      await expect(service.verificarYDescontarStock(params)).rejects.toThrow(BadRequestException);
    });
  });

  it('entradaStock ajusta con delta positivo y tipo ENTRADA', async () => {
    await service.entradaStock({ tenantId: 't1', productoId: 'p1', bodegaId: 'b1', cantidad: 7, userId: 'u1', motivo: 'compra' });
    expect(repository.ajustarCantidad).toHaveBeenCalledWith(
      expect.objectContaining({ delta: 7, tipo: 'ENTRADA' }),
    );
  });

  it('ajustarStock permite delta negativo directo con tipo AJUSTE', async () => {
    await service.ajustarStock({ tenantId: 't1', productoId: 'p1', bodegaId: 'b1', cantidad: -3, userId: 'u1', motivo: 'merma' });
    expect(repository.ajustarCantidad).toHaveBeenCalledWith(
      expect.objectContaining({ delta: -3, tipo: 'AJUSTE' }),
    );
  });

  describe('aislamiento de tenant (Stock no tiene tenantId propio)', () => {
    it('verificarYDescontarStock rechaza si el producto no pertenece al tenant actual', async () => {
      productosService.buscarPorId.mockRejectedValue(new Error('No encontrado'));

      await expect(
        service.verificarYDescontarStock({ tenantId: 't1', productoId: 'ajeno', bodegaId: 'b1', cantidad: 1, userId: 'u1', referencia: 'x' }),
      ).rejects.toThrow('No encontrado');
      expect(repository.obtenerStock).not.toHaveBeenCalled();
    });

    it('listarStockPorBodega rechaza si la bodega no pertenece al tenant actual', async () => {
      repository.buscarBodegaPorId.mockRejectedValue(new Error('No encontrado'));

      await expect(service.listarStockPorBodega('ajena')).rejects.toThrow('No encontrado');
      expect(repository.listarStockPorBodega).not.toHaveBeenCalled();
    });

    it('transferirStock valida las dos bodegas (origen y destino) y el producto', async () => {
      await service.transferirStock({ tenantId: 't1', productoId: 'p1', bodegaOrigenId: 'origen', bodegaDestinoId: 'destino', cantidad: 4, userId: 'u1' });

      expect(productosService.buscarPorId).toHaveBeenCalledWith('p1');
      expect(repository.buscarBodegaPorId).toHaveBeenCalledWith('origen');
      expect(repository.buscarBodegaPorId).toHaveBeenCalledWith('destino');
    });
  });

  it('transferirStock delega en repository.transferir (una sola transacción para origen+destino, todo-o-nada)', async () => {
    const params = { tenantId: 't1', productoId: 'p1', bodegaOrigenId: 'origen', bodegaDestinoId: 'destino', cantidad: 4, userId: 'u1' };

    await service.transferirStock(params);

    expect(repository.transferir).toHaveBeenCalledWith(params);
    expect(repository.ajustarCantidad).not.toHaveBeenCalled();
  });
});
