import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { InventarioService } from './inventario.service';
import { InventarioRepository } from './inventario.repository';
import { ProductosService } from '../productos/productos.service';
import { VariantesService } from '../variantes/variantes.service';
import { SucursalesRepository } from '../sucursales/sucursales.repository';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { AuthService } from '../auth/auth.service';

describe('InventarioService', () => {
  let service: InventarioService;
  let repository: jest.Mocked<InventarioRepository>;
  let productosService: jest.Mocked<ProductosService>;
  let variantesService: jest.Mocked<VariantesService>;
  let sucursalesRepository: jest.Mocked<SucursalesRepository>;
  let eventBus: jest.Mocked<EventBusService>;
  let authService: jest.Mocked<AuthService>;

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
      buscarBodegaPorId: jest.fn().mockResolvedValue({ id: 'b1', sucursalId: 's1' }),
      obtenerVarianteConProducto: jest.fn(),
      movimientosPorVarianteBodega: jest.fn(),
    } as unknown as jest.Mocked<InventarioRepository>;
    productosService = { buscarPorId: jest.fn().mockResolvedValue({ id: 'p1' }) } as unknown as jest.Mocked<ProductosService>;
    variantesService = { resolverObligatoria: jest.fn().mockResolvedValue('v1') } as unknown as jest.Mocked<VariantesService>;
    sucursalesRepository = {
      buscarPorId: jest.fn().mockResolvedValue({ id: 's1' }),
      usuarioPuedeOperar: jest.fn().mockResolvedValue(true),
      usuarioPuedeOperarEnTx: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<SucursalesRepository>;
    eventBus = { emit: jest.fn(), on: jest.fn() } as unknown as jest.Mocked<EventBusService>;
    authService = { verificarPin: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<AuthService>;
    service = new InventarioService(repository, productosService, variantesService, sucursalesRepository, eventBus, authService);
  });

  describe('crearBodega', () => {
    it('valida que la sucursal pertenezca al tenant antes de crear la bodega', async () => {
      repository.crearBodega.mockResolvedValue({ id: 'b1' } as never);

      await service.crearBodega('t1', 's1', 'Bodega Norte', 'Calle 1');

      expect(sucursalesRepository.buscarPorId).toHaveBeenCalledWith('s1');
      expect(repository.crearBodega).toHaveBeenCalledWith('t1', 's1', 'Bodega Norte', 'Calle 1');
    });

    it('propaga el 404 si la sucursal no pertenece al tenant (cross-tenant)', async () => {
      sucursalesRepository.buscarPorId.mockRejectedValue(new Error('not found'));

      await expect(service.crearBodega('t1', 's-otro-tenant', 'Bodega Norte')).rejects.toThrow('not found');
      expect(repository.crearBodega).not.toHaveBeenCalled();
    });
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
        varianteId: 'v1',
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

  describe('Fase 9 — enforcement de permisos por sucursal', () => {
    it('verificarYDescontarStock lanza ForbiddenException si el usuario no tiene acceso a la sucursal de la bodega', async () => {
      sucursalesRepository.usuarioPuedeOperar.mockResolvedValue(false);
      repository.descontarStockCondicional.mockResolvedValue({ cantidadActual: 15, stockMinimo: 5 } as never);

      await expect(
        service.verificarYDescontarStock({ tenantId: 't1', productoId: 'p1', bodegaId: 'b1', cantidad: 5, userId: 'u1', referencia: 'x' }),
      ).rejects.toThrow(ForbiddenException);
      expect(sucursalesRepository.usuarioPuedeOperar).toHaveBeenCalledWith('u1', 's1');
      expect(repository.descontarStockCondicional).not.toHaveBeenCalled();
    });

    it('sin ninguna sucursal asignada (default permisivo), usuarioPuedeOperar resuelve true y la operación procede', async () => {
      repository.descontarStockCondicional.mockResolvedValue({ cantidadActual: 15, stockMinimo: 5 } as never);

      await service.verificarYDescontarStock({ tenantId: 't1', productoId: 'p1', bodegaId: 'b1', cantidad: 5, userId: 'u1', referencia: 'x' });

      expect(repository.descontarStockCondicional).toHaveBeenCalled();
    });

    it('ajustarStock también queda cubierto por el enforcement', async () => {
      sucursalesRepository.usuarioPuedeOperar.mockResolvedValue(false);

      await expect(
        service.ajustarStock({ tenantId: 't1', productoId: 'p1', bodegaId: 'b1', cantidad: -3, userId: 'u1', motivoAjuste: 'MERMA' }),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.ajustarCantidad).not.toHaveBeenCalled();
    });

    it('kardex (solo lectura) NO aplica el enforcement — no llama a usuarioPuedeOperar', async () => {
      repository.movimientosPorVarianteBodega.mockResolvedValue([]);
      repository.obtenerVarianteConProducto.mockResolvedValue({
        id: 'v1',
        sku: 'sku-1',
        producto: { id: 'p1', codigo: 'P1', nombre: 'Producto 1' },
      } as never);

      await service.kardex('v1', 'b1');

      expect(sucursalesRepository.usuarioPuedeOperar).not.toHaveBeenCalled();
    });
  });

  it('entradaStock ajusta con delta positivo y tipo ENTRADA', async () => {
    await service.entradaStock({ tenantId: 't1', productoId: 'p1', bodegaId: 'b1', cantidad: 7, userId: 'u1', motivo: 'compra' });
    expect(repository.ajustarCantidad).toHaveBeenCalledWith(
      expect.objectContaining({ delta: 7, tipo: 'ENTRADA' }),
    );
  });

  it('ajustarStock permite delta negativo directo con tipo AJUSTE', async () => {
    await service.ajustarStock({ tenantId: 't1', productoId: 'p1', bodegaId: 'b1', cantidad: -3, userId: 'u1', motivoAjuste: 'MERMA' });
    expect(repository.ajustarCantidad).toHaveBeenCalledWith(
      expect.objectContaining({ delta: -3, tipo: 'AJUSTE' }),
    );
  });

  describe('ajustarStock — motivo estructurado (plan de integración Cuadre, E-2)', () => {
    it('usa el motivo libre cuando viene', async () => {
      await service.ajustarStock({ tenantId: 't1', productoId: 'p1', bodegaId: 'b1', cantidad: -3, userId: 'u1', motivoAjuste: 'MERMA', motivo: 'Se rompieron 3 unidades' });
      expect(repository.ajustarCantidad).toHaveBeenCalledWith(
        expect.objectContaining({ motivo: 'Se rompieron 3 unidades', motivoAjuste: 'MERMA' }),
      );
    });

    it('si no viene motivo libre, usa la etiqueta legible del motivoAjuste', async () => {
      await service.ajustarStock({ tenantId: 't1', productoId: 'p1', bodegaId: 'b1', cantidad: -3, userId: 'u1', motivoAjuste: 'ROBO_PERDIDA' });
      expect(repository.ajustarCantidad).toHaveBeenCalledWith(
        expect.objectContaining({ motivo: 'Robo o pérdida', motivoAjuste: 'ROBO_PERDIDA' }),
      );
    });
  });

  describe('ajustarStock — Fase 9, PIN de confirmación solo en salidas', () => {
    it('NO pide PIN en una entrada (cantidad positiva)', async () => {
      await service.ajustarStock({ tenantId: 't1', productoId: 'p1', bodegaId: 'b1', cantidad: 5, userId: 'u1', motivoAjuste: 'CORRECCION_CONTEO' });
      expect(authService.verificarPin).not.toHaveBeenCalled();
    });

    it('pide y valida el PIN en una salida (cantidad negativa)', async () => {
      await service.ajustarStock({ tenantId: 't1', productoId: 'p1', bodegaId: 'b1', cantidad: -3, userId: 'u1', motivoAjuste: 'MERMA', pin: '1234' });
      expect(authService.verificarPin).toHaveBeenCalledWith('u1', '1234');
    });

    it('propaga el PIN incorrecto sin ajustar el stock', async () => {
      authService.verificarPin.mockRejectedValue(new Error('PIN incorrecto'));

      await expect(
        service.ajustarStock({ tenantId: 't1', productoId: 'p1', bodegaId: 'b1', cantidad: -3, userId: 'u1', motivoAjuste: 'MERMA', pin: 'mal' }),
      ).rejects.toThrow('PIN incorrecto');
      expect(repository.ajustarCantidad).not.toHaveBeenCalled();
    });
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

      await expect(service.listarStockPorBodega('ajena', {})).rejects.toThrow('No encontrado');
      expect(repository.listarStockPorBodega).not.toHaveBeenCalled();
    });

    it('listarStockPorBodega pagina y pasa la búsqueda al repositorio', async () => {
      repository.listarStockPorBodega.mockResolvedValue([[{ id: 's1' }], 1] as never);

      const resultado = await service.listarStockPorBodega('b1', { pagina: 2, tamanoPagina: 10, busqueda: 'martillo' });

      expect(repository.listarStockPorBodega).toHaveBeenCalledWith('b1', { skip: 10, take: 10, busqueda: 'martillo' });
      expect(resultado).toEqual({ datos: [{ id: 's1' }], total: 1, pagina: 2, tamanoPagina: 10 });
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

    expect(repository.transferir).toHaveBeenCalledWith({ ...params, varianteId: 'v1' });
    expect(repository.ajustarCantidad).not.toHaveBeenCalled();
  });

  describe('transferirStock — Fase 9, exige acceso a AMBAS sucursales (origen y destino)', () => {
    const params = { tenantId: 't1', productoId: 'p1', bodegaOrigenId: 'origen', bodegaDestinoId: 'destino', cantidad: 4, userId: 'u1' };

    beforeEach(() => {
      repository.buscarBodegaPorId.mockImplementation((id: string) =>
        Promise.resolve({ id, sucursalId: id === 'origen' ? 's-origen' : 's-destino' }) as never,
      );
    });

    it('permite si tiene acceso a las dos sucursales', async () => {
      sucursalesRepository.usuarioPuedeOperar.mockResolvedValue(true);

      await service.transferirStock(params);

      expect(repository.transferir).toHaveBeenCalled();
    });

    it('lanza ForbiddenException si tiene acceso a la de origen pero no a la de destino', async () => {
      sucursalesRepository.usuarioPuedeOperar.mockImplementation((_userId, sucursalId) => Promise.resolve(sucursalId === 's-origen'));

      await expect(service.transferirStock(params)).rejects.toThrow(ForbiddenException);
      expect(repository.transferir).not.toHaveBeenCalled();
    });

    it('lanza ForbiddenException si tiene acceso a la de destino pero no a la de origen', async () => {
      sucursalesRepository.usuarioPuedeOperar.mockImplementation((_userId, sucursalId) => Promise.resolve(sucursalId === 's-destino'));

      await expect(service.transferirStock(params)).rejects.toThrow(ForbiddenException);
      expect(repository.transferir).not.toHaveBeenCalled();
    });

    it('lanza ForbiddenException si no tiene acceso a NINGUNA de las dos', async () => {
      sucursalesRepository.usuarioPuedeOperar.mockResolvedValue(false);

      await expect(service.transferirStock(params)).rejects.toThrow(ForbiddenException);
      expect(repository.transferir).not.toHaveBeenCalled();
    });
  });

  describe('kardex (Fase 5a)', () => {
    function movimiento(overrides: Record<string, unknown> = {}) {
      return {
        id: 'm1',
        createdAt: new Date('2026-07-10'),
        tipo: 'ENTRADA',
        direccion: 'ENTRADA',
        cantidad: 10,
        motivo: null,
        user: { nombre: 'Ana' },
        ...overrides,
      };
    }

    beforeEach(() => {
      repository.obtenerVarianteConProducto.mockResolvedValue({
        id: 'v1',
        sku: 'SKU-1',
        producto: { id: 'p1', codigo: 'COD-1', nombre: 'Producto 1' },
      } as never);
    });

    it('usa `direccion` (no `tipo`) para el signo — un AJUSTE negativo resta del saldo', async () => {
      repository.movimientosPorVarianteBodega.mockResolvedValue([
        movimiento({ tipo: 'ENTRADA', direccion: 'ENTRADA', cantidad: 20, createdAt: new Date('2026-07-01') }),
        movimiento({ tipo: 'AJUSTE', direccion: 'SALIDA', cantidad: 3, createdAt: new Date('2026-07-05') }),
      ] as never);

      const resultado = await service.kardex('v1', 'b1', '2026-07-01', '2026-07-31');

      expect(resultado.movimientos[1].saldoAcumulado).toBe(17);
      expect(resultado.saldoFinal).toBe(17);
    });

    it('acumula en saldoInicial los movimientos anteriores a `desde`, sin listarlos', async () => {
      repository.movimientosPorVarianteBodega.mockResolvedValue([
        movimiento({ direccion: 'ENTRADA', cantidad: 50, createdAt: new Date('2026-06-15') }),
        movimiento({ direccion: 'SALIDA', cantidad: 10, createdAt: new Date('2026-07-10') }),
      ] as never);

      const resultado = await service.kardex('v1', 'b1', '2026-07-01', '2026-07-31');

      expect(resultado.saldoInicial).toBe(50);
      expect(resultado.movimientos).toHaveLength(1);
      expect(resultado.movimientos[0].saldoAcumulado).toBe(40);
    });

    it('sin movimientos en el rango, saldoFinal es igual a saldoInicial', async () => {
      repository.movimientosPorVarianteBodega.mockResolvedValue([
        movimiento({ direccion: 'ENTRADA', cantidad: 8, createdAt: new Date('2026-06-01') }),
      ] as never);

      const resultado = await service.kardex('v1', 'b1', '2026-07-01', '2026-07-31');

      expect(resultado.movimientos).toEqual([]);
      expect(resultado.saldoInicial).toBe(8);
      expect(resultado.saldoFinal).toBe(8);
    });

    it('valida que la bodega pertenezca al tenant antes de consultar', async () => {
      repository.movimientosPorVarianteBodega.mockResolvedValue([]);

      await service.kardex('v1', 'b1');

      expect(repository.buscarBodegaPorId).toHaveBeenCalledWith('b1');
    });
  });
});
