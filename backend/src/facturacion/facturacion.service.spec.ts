import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { FacturacionService } from './facturacion.service';
import { FacturacionRepository } from './facturacion.repository';
import { InventarioService } from '../inventario/inventario.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { CrearFacturaDto } from './dto/crear-factura.dto';
import { PagosService } from '../pagos/pagos.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClientesService } from '../clientes/clientes.service';

describe('FacturacionService', () => {
  let service: FacturacionService;
  let repository: jest.Mocked<FacturacionRepository>;
  let inventarioService: jest.Mocked<InventarioService>;
  let tenantPrisma: { client: { $transaction: jest.Mock } };
  let eventBus: jest.Mocked<EventBusService>;
  let pagosService: jest.Mocked<PagosService>;
  let prisma: jest.Mocked<PrismaService>;
  let clientesService: jest.Mocked<ClientesService>;

  // Un tx opaco: crear()/anular() abren la transacción con tenantPrisma.client.$transaction
  // y pasan este objeto a los métodos *EnTx — para las pruebas basta con que sea el mismo
  // valor en cada llamada, no hace falta que se comporte como un Prisma.TransactionClient real.
  const TX = { esTransaccion: true };

  const producto = (porcentajeItbis: number, precioVenta: number, tipo: 'PRODUCTO' | 'SERVICIO' | 'COMBO' = 'PRODUCTO', componentes: unknown[] = []) => ({
    precios: [{ precioVenta }],
    porcentajeItbis,
    tipo,
    componentes,
  });

  function facturaCreada(overrides: Record<string, unknown> = {}) {
    return {
      id: 'f1',
      clienteId: 'cliente-1',
      total: 0,
      subtotal: 0,
      itbis: 0,
      tipoFactura: 'CONTADO',
      ...overrides,
    };
  }

  beforeEach(() => {
    repository = {
      obtenerProductoConPrecioVigente: jest.fn(),
      obtenerModalidadFacturacion: jest.fn().mockResolvedValue('NCF'),
      siguienteNcfEnTx: jest.fn().mockResolvedValue('B0200000001'),
      crearFacturaEnTx: jest.fn(),
      buscarPorId: jest.fn(),
      listar: jest.fn(),
      anularEnTx: jest.fn(),
    } as unknown as jest.Mocked<FacturacionRepository>;
    inventarioService = {
      verificarYDescontarStockEnTx: jest.fn().mockResolvedValue(undefined),
      entradaStockEnTx: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<InventarioService>;
    tenantPrisma = { client: { $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(TX)) } };
    eventBus = { emit: jest.fn(), on: jest.fn() } as unknown as jest.Mocked<EventBusService>;
    pagosService = {
      registrarPagoFactura: jest.fn(),
      registrarPagoOrdenCompra: jest.fn(),
      listarPorFactura: jest.fn(),
      listarPorOrdenCompra: jest.fn(),
    } as unknown as jest.Mocked<PagosService>;
    prisma = {
      bodega: { findFirst: jest.fn().mockResolvedValue(null) },
      configuracion: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as jest.Mocked<PrismaService>;
    clientesService = {
      buscarPorId: jest.fn().mockResolvedValue({ id: 'cliente-1', listaPrecio: null }),
    } as unknown as jest.Mocked<ClientesService>;
    service = new FacturacionService(
      repository,
      inventarioService,
      tenantPrisma as unknown as TenantPrismaService,
      eventBus,
      pagosService,
      prisma,
      clientesService,
    );
  });

  function dto(overrides: Partial<CrearFacturaDto> = {}): CrearFacturaDto {
    return {
      clienteId: 'cliente-1',
      bodegaId: 'bodega-1',
      tipoFactura: 'CONTADO',
      lineas: [{ productoId: 'prod-1', cantidad: 2 }],
      ...overrides,
    } as CrearFacturaDto;
  }

  describe('resolución del nivel de precio (Fase 3b)', () => {
    it('usa GENERAL si el cliente no tiene lista asignada y no hay override', async () => {
      clientesService.buscarPorId.mockResolvedValue({ id: 'cliente-1', listaPrecio: null } as never);
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);

      await service.crear(dto(), 'tenant-1', 'vendedor-1');

      expect(repository.obtenerProductoConPrecioVigente).toHaveBeenCalledWith('prod-1', 'GENERAL');
    });

    it('usa la lista del cliente cuando no hay override explícito en el dto', async () => {
      clientesService.buscarPorId.mockResolvedValue({ id: 'cliente-1', listaPrecio: { id: 'lp-1', nombre: 'Mayorista' } } as never);
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);

      await service.crear(dto(), 'tenant-1', 'vendedor-1');

      expect(repository.obtenerProductoConPrecioVigente).toHaveBeenCalledWith('prod-1', 'Mayorista');
    });

    it('el override explícito del dto.listaPrecio tiene prioridad sobre la lista del cliente', async () => {
      clientesService.buscarPorId.mockResolvedValue({ id: 'cliente-1', listaPrecio: { id: 'lp-1', nombre: 'Mayorista' } } as never);
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);

      await service.crear(dto({ listaPrecio: 'Distribuidor' }), 'tenant-1', 'vendedor-1');

      expect(repository.obtenerProductoConPrecioVigente).toHaveBeenCalledWith('prod-1', 'Distribuidor');
    });
  });

  it('calcula subtotal/itbis/total usando el precio vigente del producto cuando no se envía precioUnitario', async () => {
    repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 150) as never);
    repository.crearFacturaEnTx.mockResolvedValue(facturaCreada({ total: 354 }) as never);

    await service.crear(dto({ lineas: [{ productoId: 'prod-1', cantidad: 2 }] }), 'tenant-1', 'vendedor-1');

    // 2 * 150 = 300 subtotal; itbis 18% = 54; total = 354
    expect(repository.crearFacturaEnTx).toHaveBeenCalledWith(
      TX,
      expect.objectContaining({ subtotal: 300, itbis: 54, total: 354, descuento: 0 }),
    );
  });

  it('usa el precioUnitario explícito de la línea en vez del precio vigente', async () => {
    repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 999) as never);
    repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);

    await service.crear(
      dto({ lineas: [{ productoId: 'prod-1', cantidad: 1, precioUnitario: 100 }] }),
      'tenant-1',
      'vendedor-1',
    );

    expect(repository.crearFacturaEnTx).toHaveBeenCalledWith(TX, expect.objectContaining({ subtotal: 100, itbis: 18 }));
  });

  it('resta el descuento de línea antes de calcular el ITBIS', async () => {
    repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
    repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);

    // 1 * 100 - 20 descuento = 80 base; itbis 18% de 80 = 14.4
    await service.crear(
      dto({ lineas: [{ productoId: 'prod-1', cantidad: 1, descuento: 20 }] }),
      'tenant-1',
      'vendedor-1',
    );

    const [, llamada] = repository.crearFacturaEnTx.mock.calls[0];
    expect(llamada.subtotal).toBe(80);
    expect(llamada.descuento).toBe(20);
    expect(llamada.itbis).toBeCloseTo(14.4, 5);
  });

  it.each([
    ['CONTADO', 'B02'],
    ['CREDITO', 'B01'],
    ['NOTA_DEBITO', 'B03'],
    ['NOTA_CREDITO', 'B04'],
  ])('asigna el tipo de NCF %s -> %s', async (tipoFactura, tipoNcfEsperado) => {
    repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
    repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);

    await service.crear(dto({ tipoFactura: tipoFactura as CrearFacturaDto['tipoFactura'] }), 'tenant-1', 'vendedor-1');

    expect(repository.siguienteNcfEnTx).toHaveBeenCalledWith(TX, tipoNcfEsperado);
  });

  it.each([
    ['CONTADO', 'E32'],
    ['CREDITO', 'E31'],
    ['NOTA_DEBITO', 'E33'],
    ['NOTA_CREDITO', 'E34'],
  ])('en modalidad ECF asigna e-NCF %s -> %s en vez de NCF tradicional', async (tipoFactura, tipoEcfEsperado) => {
    repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
    repository.obtenerModalidadFacturacion.mockResolvedValue('ECF' as never);
    repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);

    await service.crear(dto({ tipoFactura: tipoFactura as CrearFacturaDto['tipoFactura'] }), 'tenant-1', 'vendedor-1');

    expect(repository.siguienteNcfEnTx).toHaveBeenCalledWith(TX, tipoEcfEsperado);
  });

  it('verifica y descuenta stock de cada línea antes de crear la factura (venta normal)', async () => {
    repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
    repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);

    await service.crear(dto(), 'tenant-1', 'vendedor-1');

    expect(inventarioService.verificarYDescontarStockEnTx).toHaveBeenCalledWith(
      TX,
      expect.objectContaining({ tenantId: 'tenant-1', productoId: 'prod-1', bodegaId: 'bodega-1', cantidad: 2, userId: 'vendedor-1' }),
    );
    const ordenDescuento = inventarioService.verificarYDescontarStockEnTx.mock.invocationCallOrder[0];
    const ordenCreacion = repository.crearFacturaEnTx.mock.invocationCallOrder[0];
    expect(ordenDescuento).toBeLessThan(ordenCreacion);
  });

  it('un producto SERVICIO no descuenta stock (no tiene fila propia en Stock)', async () => {
    repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 500, 'SERVICIO') as never);
    repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);

    await service.crear(dto({ lineas: [{ productoId: 'servicio-1', cantidad: 1 }] }), 'tenant-1', 'vendedor-1');

    expect(inventarioService.verificarYDescontarStockEnTx).not.toHaveBeenCalled();
  });

  it('un producto COMBO expande a sus componentes físicos (cantidad de la línea × cantidad del componente)', async () => {
    repository.obtenerProductoConPrecioVigente.mockResolvedValue(
      producto(18, 500, 'COMBO', [
        { cantidad: 2, componente: { id: 'comp-1', tipo: 'PRODUCTO' } },
        { cantidad: 1, componente: { id: 'comp-2', tipo: 'PRODUCTO' } },
        // Un componente SERVICIO dentro de un combo tampoco mueve stock.
        { cantidad: 1, componente: { id: 'comp-servicio', tipo: 'SERVICIO' } },
      ]) as never,
    );
    repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);

    await service.crear(dto({ lineas: [{ productoId: 'combo-1', cantidad: 3 }] }), 'tenant-1', 'vendedor-1');

    expect(inventarioService.verificarYDescontarStockEnTx).toHaveBeenCalledTimes(2);
    expect(inventarioService.verificarYDescontarStockEnTx).toHaveBeenCalledWith(
      TX,
      expect.objectContaining({ productoId: 'comp-1', cantidad: 6 }), // 3 combos × 2 c/u
    );
    expect(inventarioService.verificarYDescontarStockEnTx).toHaveBeenCalledWith(
      TX,
      expect.objectContaining({ productoId: 'comp-2', cantidad: 3 }), // 3 combos × 1 c/u
    );
  });

  it('si falta stock, no crea la factura ni emite el evento (y el intento de descuento se revierte junto con todo lo demás de la transacción)', async () => {
    repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
    inventarioService.verificarYDescontarStockEnTx.mockRejectedValue(new Error('Stock insuficiente'));

    await expect(service.crear(dto(), 'tenant-1', 'vendedor-1')).rejects.toThrow('Stock insuficiente');

    expect(repository.crearFacturaEnTx).not.toHaveBeenCalled();
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it('emite FACTURA_CREADA con el total ya calculado', async () => {
    repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
    repository.crearFacturaEnTx.mockResolvedValue(facturaCreada({ total: 118 }) as never);

    await service.crear(dto(), 'tenant-1', 'vendedor-1');

    expect(eventBus.emit).toHaveBeenCalledWith(
      EVENTOS.FACTURA_CREADA,
      expect.objectContaining({ tenantId: 'tenant-1', facturaId: 'f1', clienteId: 'cliente-1', total: '118' }),
    );
  });

  it('descuento de stock, consumo de NCF y creación de factura corren dentro de la misma transacción', async () => {
    repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
    repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);

    await service.crear(dto(), 'tenant-1', 'vendedor-1');

    expect(tenantPrisma.client.$transaction).toHaveBeenCalledTimes(1);
    expect(inventarioService.verificarYDescontarStockEnTx).toHaveBeenCalledWith(TX, expect.anything());
    expect(repository.siguienteNcfEnTx).toHaveBeenCalledWith(TX, expect.anything());
    expect(repository.crearFacturaEnTx).toHaveBeenCalledWith(TX, expect.anything());
  });

  describe('pago dividido (opciones.pagos)', () => {
    it('sin formaPagoId ni pagos, no crea ningún PagoVenta', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada({ total: 236 }) as never);

      await service.crear(dto(), 'tenant-1', 'vendedor-1');

      expect(repository.crearFacturaEnTx).toHaveBeenCalledWith(
        TX,
        expect.objectContaining({ formaPagoId: undefined, referenciaPago: undefined, pagos: [] }),
      );
    });

    it('con un solo formaPagoId (sin pagos explícitos), sintetiza un único PagoVenta por el total', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada({ total: 236 }) as never);

      await service.crear(dto(), 'tenant-1', 'vendedor-1', { formaPagoId: 'fp1', referenciaPago: 'ref-1' });

      expect(repository.crearFacturaEnTx).toHaveBeenCalledWith(
        TX,
        expect.objectContaining({
          formaPagoId: 'fp1',
          referenciaPago: 'ref-1',
          pagos: [{ formaPagoId: 'fp1', monto: 236, referencia: 'ref-1' }],
        }),
      );
    });

    it('con pagos explícitos que suman exacto el total, los pasa tal cual y la forma de pago principal es la de mayor monto', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada({ total: 236 }) as never);

      await service.crear(dto(), 'tenant-1', 'vendedor-1', {
        pagos: [
          { formaPagoId: 'fp-efectivo', monto: 200 },
          { formaPagoId: 'fp-tarjeta', monto: 36 },
        ],
      });

      expect(repository.crearFacturaEnTx).toHaveBeenCalledWith(
        TX,
        expect.objectContaining({
          formaPagoId: 'fp-efectivo',
          referenciaPago: undefined,
          pagos: [
            { formaPagoId: 'fp-efectivo', monto: 200 },
            { formaPagoId: 'fp-tarjeta', monto: 36 },
          ],
        }),
      );
    });

    it('rechaza si la suma de los pagos no coincide con el total (fuera de EPSILON)', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);

      await expect(
        service.crear(dto(), 'tenant-1', 'vendedor-1', {
          pagos: [{ formaPagoId: 'fp1', monto: 100 }],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.crearFacturaEnTx).not.toHaveBeenCalled();
    });

    it('acepta una diferencia de centavos dentro del EPSILON', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada({ total: 236 }) as never);

      await service.crear(dto(), 'tenant-1', 'vendedor-1', {
        pagos: [{ formaPagoId: 'fp1', monto: 236.003 }],
      });

      expect(repository.crearFacturaEnTx).toHaveBeenCalled();
    });
  });

  describe('notas de crédito y débito', () => {
    it('NOTA_CREDITO devuelve stock (entradaStockEnTx) en vez de descontarlo', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada({ id: 'nc1', total: -118 }) as never);

      await service.crear(dto({ tipoFactura: 'NOTA_CREDITO', facturaOrigenId: 'f-original' }), 'tenant-1', 'vendedor-1');

      expect(inventarioService.entradaStockEnTx).toHaveBeenCalledWith(
        TX,
        expect.objectContaining({ productoId: 'prod-1', bodegaId: 'bodega-1', cantidad: 2 }),
      );
      expect(inventarioService.verificarYDescontarStockEnTx).not.toHaveBeenCalled();
    });

    it('NOTA_CREDITO guarda subtotal/itbis/total en negativo para que el neto de reportes sea correcto', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada({ id: 'nc1', total: -118 }) as never);

      // 1 * 100 = 100 subtotal; itbis 18% = 18; total 118 -> negativo
      await service.crear(dto({ tipoFactura: 'NOTA_CREDITO', lineas: [{ productoId: 'prod-1', cantidad: 1 }] }), 'tenant-1', 'vendedor-1');

      expect(repository.crearFacturaEnTx).toHaveBeenCalledWith(
        TX,
        expect.objectContaining({ subtotal: -100, itbis: -18, total: -118 }),
      );
    });

    it('NOTA_DEBITO no mueve inventario (es un ajuste monetario, sin contrapartida física)', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada({ id: 'nd1', total: 118 }) as never);

      await service.crear(dto({ tipoFactura: 'NOTA_DEBITO', facturaOrigenId: 'f-original' }), 'tenant-1', 'vendedor-1');

      expect(inventarioService.entradaStockEnTx).not.toHaveBeenCalled();
      expect(inventarioService.verificarYDescontarStockEnTx).not.toHaveBeenCalled();
    });
  });

  describe('anular', () => {
    function facturaExistente(overrides: Record<string, unknown> = {}) {
      return {
        id: 'f1',
        clienteId: 'cliente-1',
        total: 200,
        subtotal: 200,
        itbis: 0,
        estado: 'EMITIDA',
        tipoFactura: 'CONTADO',
        bodegaId: 'bodega-1',
        ncf: 'B0200000001',
        lineas: [{ productoId: 'prod-1', cantidad: 3, producto: { tipo: 'PRODUCTO', componentes: [] } }],
        notasRelacionadas: [],
        ...overrides,
      };
    }

    it('emite FACTURA_ANULADA y retorna la factura anulada', async () => {
      repository.buscarPorId.mockResolvedValue(facturaExistente() as never);
      repository.anularEnTx.mockResolvedValue(facturaCreada({ total: 200, subtotal: 200 }) as never);

      const resultado = await service.anular('f1', 'Motivo de prueba', 'tenant-1', 'user-1', true);

      expect(repository.anularEnTx).toHaveBeenCalledWith(TX, 'f1', 'Motivo de prueba');
      expect(eventBus.emit).toHaveBeenCalledWith(
        EVENTOS.FACTURA_ANULADA,
        expect.objectContaining({ tenantId: 'tenant-1', facturaId: 'f1', clienteId: 'cliente-1', total: '200' }),
      );
      expect(resultado).toEqual(expect.objectContaining({ id: 'f1' }));
    });

    it('rechaza anular una factura que ya está anulada', async () => {
      repository.buscarPorId.mockResolvedValue(facturaExistente({ estado: 'ANULADA' }) as never);

      await expect(service.anular('f1', 'Motivo de prueba', 'tenant-1', 'user-1', true)).rejects.toThrow(BadRequestException);
      expect(repository.anularEnTx).not.toHaveBeenCalled();
    });

    it('un Cajero sin pos.supervisar no puede anular una venta de POS del turno de OTRO cajero', async () => {
      repository.buscarPorId.mockResolvedValue(
        facturaExistente({ turnoCaja: { cajeroId: 'otro-cajero', estado: 'ABIERTO' } }) as never,
      );

      await expect(service.anular('f1', 'Motivo de prueba', 'tenant-1', 'user-1', false)).rejects.toThrow(ForbiddenException);
      expect(repository.anularEnTx).not.toHaveBeenCalled();
    });

    it('un Cajero sin pos.supervisar no puede anular una venta de POS de SU turno ya cerrado', async () => {
      repository.buscarPorId.mockResolvedValue(
        facturaExistente({ turnoCaja: { cajeroId: 'user-1', estado: 'CERRADO' } }) as never,
      );

      await expect(service.anular('f1', 'Motivo de prueba', 'tenant-1', 'user-1', false)).rejects.toThrow(ForbiddenException);
      expect(repository.anularEnTx).not.toHaveBeenCalled();
    });

    it('un Cajero sin pos.supervisar sí puede anular una venta de POS de SU propio turno abierto', async () => {
      repository.buscarPorId.mockResolvedValue(
        facturaExistente({ turnoCaja: { cajeroId: 'user-1', estado: 'ABIERTO' } }) as never,
      );
      repository.anularEnTx.mockResolvedValue(facturaCreada({ total: 200, subtotal: 200 }) as never);

      await service.anular('f1', 'Motivo de prueba', 'tenant-1', 'user-1', false);

      expect(repository.anularEnTx).toHaveBeenCalledWith(TX, 'f1', 'Motivo de prueba');
    });

    it('anular una venta normal (CONTADO/CREDITO) devuelve el stock a la bodega', async () => {
      repository.buscarPorId.mockResolvedValue(facturaExistente() as never);
      repository.anularEnTx.mockResolvedValue(facturaCreada({ total: 200, subtotal: 200 }) as never);

      await service.anular('f1', 'Motivo de prueba', 'tenant-1', 'user-1', true);

      expect(inventarioService.entradaStockEnTx).toHaveBeenCalledWith(
        TX,
        expect.objectContaining({ productoId: 'prod-1', bodegaId: 'bodega-1', cantidad: 3, userId: 'user-1' }),
      );
      expect(inventarioService.verificarYDescontarStockEnTx).not.toHaveBeenCalled();
    });

    it('anular una NOTA_CREDITO retira de nuevo el stock que había devuelto', async () => {
      repository.buscarPorId.mockResolvedValue(facturaExistente({ tipoFactura: 'NOTA_CREDITO', total: -200, subtotal: -200 }) as never);
      repository.anularEnTx.mockResolvedValue(facturaCreada({ total: -200, subtotal: -200 }) as never);

      await service.anular('f1', 'Motivo de prueba', 'tenant-1', 'user-1', true);

      expect(inventarioService.verificarYDescontarStockEnTx).toHaveBeenCalledWith(
        TX,
        expect.objectContaining({ productoId: 'prod-1', bodegaId: 'bodega-1', cantidad: 3, userId: 'user-1' }),
      );
      expect(inventarioService.entradaStockEnTx).not.toHaveBeenCalled();
    });

    it('anular una venta con una nota de crédito parcial ya emitida solo reintegra lo que falta (no duplica lo ya devuelto)', async () => {
      repository.buscarPorId.mockResolvedValue(
        facturaExistente({
          lineas: [{ productoId: 'prod-1', cantidad: 5, producto: { tipo: 'PRODUCTO', componentes: [] } }],
          notasRelacionadas: [{ lineas: [{ productoId: 'prod-1', cantidad: 2 }] }],
        }) as never,
      );
      repository.anularEnTx.mockResolvedValue(facturaCreada({ total: 200, subtotal: 200 }) as never);

      await service.anular('f1', 'Motivo de prueba', 'tenant-1', 'user-1', true);

      // 5 originales - 2 ya devueltos por la nota = 3 a reintegrar, no 5
      expect(inventarioService.entradaStockEnTx).toHaveBeenCalledTimes(1);
      expect(inventarioService.entradaStockEnTx).toHaveBeenCalledWith(
        TX,
        expect.objectContaining({ productoId: 'prod-1', cantidad: 3 }),
      );
    });

    it('anular una venta ya cubierta por completo por notas de crédito no reintegra nada', async () => {
      repository.buscarPorId.mockResolvedValue(
        facturaExistente({
          lineas: [{ productoId: 'prod-1', cantidad: 3, producto: { tipo: 'PRODUCTO', componentes: [] } }],
          notasRelacionadas: [{ lineas: [{ productoId: 'prod-1', cantidad: 3 }] }],
        }) as never,
      );
      repository.anularEnTx.mockResolvedValue(facturaCreada({ total: 200, subtotal: 200 }) as never);

      await service.anular('f1', 'Motivo de prueba', 'tenant-1', 'user-1', true);

      expect(inventarioService.entradaStockEnTx).not.toHaveBeenCalled();
    });

    it('anular una venta con una línea COMBO reintegra stock a cada componente físico', async () => {
      repository.buscarPorId.mockResolvedValue(
        facturaExistente({
          lineas: [
            {
              productoId: 'combo-1',
              cantidad: 2,
              producto: {
                tipo: 'COMBO',
                componentes: [{ cantidad: 3, componente: { id: 'comp-1', tipo: 'PRODUCTO' } }],
              },
            },
          ],
        }) as never,
      );
      repository.anularEnTx.mockResolvedValue(facturaCreada({ total: 200, subtotal: 200 }) as never);

      await service.anular('f1', 'Motivo de prueba', 'tenant-1', 'user-1', true);

      expect(inventarioService.entradaStockEnTx).toHaveBeenCalledWith(
        TX,
        expect.objectContaining({ productoId: 'comp-1', cantidad: 6 }), // 2 combos × 3 c/u
      );
    });

    it('anular una NOTA_DEBITO no mueve inventario', async () => {
      repository.buscarPorId.mockResolvedValue(facturaExistente({ tipoFactura: 'NOTA_DEBITO' }) as never);
      repository.anularEnTx.mockResolvedValue(facturaCreada({ total: 200, subtotal: 200 }) as never);

      await service.anular('f1', 'Motivo de prueba', 'tenant-1', 'user-1', true);

      expect(inventarioService.entradaStockEnTx).not.toHaveBeenCalled();
      expect(inventarioService.verificarYDescontarStockEnTx).not.toHaveBeenCalled();
    });

    it('si la factura no tiene bodegaId (dato legado), no intenta mover inventario', async () => {
      repository.buscarPorId.mockResolvedValue(facturaExistente({ bodegaId: null }) as never);
      repository.anularEnTx.mockResolvedValue(facturaCreada({ total: 200, subtotal: 200 }) as never);

      await service.anular('f1', 'Motivo de prueba', 'tenant-1', 'user-1', true);

      expect(inventarioService.entradaStockEnTx).not.toHaveBeenCalled();
      expect(inventarioService.verificarYDescontarStockEnTx).not.toHaveBeenCalled();
    });
  });

  describe('registrarPago', () => {
    const dtoPago = { monto: 100, formaPagoId: 'fp1' } as never;

    it('delega en PagosService.registrarPagoFactura cuando la factura es válida', async () => {
      const factura = { id: 'f1', estado: 'EMITIDA', pagada: false, tipoFactura: 'CREDITO' };
      repository.buscarPorId.mockResolvedValue(factura as never);
      pagosService.registrarPagoFactura.mockResolvedValue({ id: 'pago-1' } as never);

      await service.registrarPago('f1', dtoPago, 'user-1', 'tenant-1');

      expect(pagosService.registrarPagoFactura).toHaveBeenCalledWith(factura, dtoPago, 'user-1', 'tenant-1');
    });

    it('rechaza registrar pago de una factura que no está EMITIDA', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'f1', estado: 'ANULADA', pagada: false, tipoFactura: 'CREDITO' } as never);

      await expect(service.registrarPago('f1', dtoPago, 'user-1', 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(pagosService.registrarPagoFactura).not.toHaveBeenCalled();
    });

    it('rechaza registrar pago de una nota de crédito/débito', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'f1', estado: 'EMITIDA', pagada: false, tipoFactura: 'NOTA_CREDITO' } as never);

      await expect(service.registrarPago('f1', dtoPago, 'user-1', 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(pagosService.registrarPagoFactura).not.toHaveBeenCalled();
    });

    it('rechaza registrar pago de una factura ya pagada en su totalidad', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'f1', estado: 'EMITIDA', pagada: true, tipoFactura: 'CREDITO' } as never);

      await expect(service.registrarPago('f1', dtoPago, 'user-1', 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(pagosService.registrarPagoFactura).not.toHaveBeenCalled();
    });
  });

  describe('generarPdf', () => {
    it('genera un PDF a partir de la factura y sus líneas', async () => {
      repository.buscarPorId.mockResolvedValue({
        id: 'f1',
        ncf: 'B0200000001',
        tipoFactura: 'CONTADO',
        fecha: new Date('2026-01-15'),
        cliente: { nombre: 'Cliente Demo' },
        subtotal: 200,
        descuento: 0,
        itbis: 36,
        total: 236,
        lineas: [{ producto: { nombre: 'Producto A' }, cantidad: 2, precioUnitario: 100, montoTotal: 236 }],
      } as never);

      const buffer = await service.generarPdf('f1');

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    });
  });
});
