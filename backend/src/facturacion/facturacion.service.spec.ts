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
import { VariantesService } from '../variantes/variantes.service';
import { OfertasService } from '../ofertas/ofertas.service';
import { BonosService } from '../bonos/bonos.service';
import { AuthService } from '../auth/auth.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

describe('FacturacionService', () => {
  let service: FacturacionService;
  let repository: jest.Mocked<FacturacionRepository>;
  let inventarioService: jest.Mocked<InventarioService>;
  let tenantPrisma: { client: { $transaction: jest.Mock } };
  let eventBus: jest.Mocked<EventBusService>;
  let pagosService: jest.Mocked<PagosService>;
  let prisma: jest.Mocked<PrismaService>;
  let clientesService: jest.Mocked<ClientesService>;
  let variantesService: jest.Mocked<VariantesService>;
  let ofertasService: jest.Mocked<OfertasService>;
  let bonosService: jest.Mocked<BonosService>;
  let authService: jest.Mocked<AuthService>;
  let notificacionesService: jest.Mocked<NotificacionesService>;

  // Un tx opaco: crear()/anular() abren la transacción con tenantPrisma.client.$transaction
  // y pasan este objeto a los métodos *EnTx — para las pruebas basta con que sea el mismo
  // valor en cada llamada, no hace falta que se comporte como un Prisma.TransactionClient real.
  const TX = { esTransaccion: true };

  const producto = (porcentajeItbis: number, precioVenta: number, tipo: 'PRODUCTO' | 'SERVICIO' | 'COMBO' = 'PRODUCTO', componentes: unknown[] = []) => ({
    nombre: 'Producto de prueba',
    precios: [{ precioVenta }],
    porcentajeItbis,
    tipo,
    componentes,
    permiteDevolucion: true,
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
      siguienteNcfEnTx: jest.fn().mockResolvedValue({ ncf: 'B0200000001', restantes: 999, umbralAlerta: null, sucursalIdUsado: null }),
      crearFacturaEnTx: jest.fn(),
      buscarPorId: jest.fn(),
      listar: jest.fn(),
      anularEnTx: jest.fn(),
    } as unknown as jest.Mocked<FacturacionRepository>;
    inventarioService = {
      verificarYDescontarStockEnTx: jest.fn().mockResolvedValue(undefined),
      entradaStockEnTx: jest.fn().mockResolvedValue(undefined),
      reconstruirLotesDeVentaEnTx: jest.fn().mockResolvedValue([]),
      validarAccesoBodega: jest.fn().mockResolvedValue({ id: 'bodega-1', sucursalId: 's1' }),
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
    variantesService = {
      resolverObligatoria: jest.fn().mockResolvedValue('variante-1'),
    } as unknown as jest.Mocked<VariantesService>;
    ofertasService = {
      resolverDescuentoLinea: jest.fn().mockResolvedValue(0),
      resolverDescuentoCarritoTotal: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<OfertasService>;
    bonosService = {
      procesarPagoEnTx: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<BonosService>;
    authService = {
      verificarPin: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuthService>;
    notificacionesService = {
      enviar: jest.fn().mockResolvedValue({ id: 'n1' }),
    } as unknown as jest.Mocked<NotificacionesService>;
    service = new FacturacionService(
      repository,
      inventarioService,
      tenantPrisma as unknown as TenantPrismaService,
      eventBus,
      pagosService,
      prisma,
      clientesService,
      variantesService,
      ofertasService,
      bonosService,
      authService,
      notificacionesService,
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

  describe('Fase 9 — enforcement de acceso por sucursal en crear()', () => {
    it('valida acceso a la sucursal de la bodega antes de calcular/crear la factura', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);

      await service.crear(dto({ bodegaId: 'bodega-9' }), 'tenant-1', 'vendedor-1');

      expect(inventarioService.validarAccesoBodega).toHaveBeenCalledWith('bodega-9', 'vendedor-1');
    });

    it('propaga el rechazo (bodega de una sucursal no asignada) sin crear la factura', async () => {
      inventarioService.validarAccesoBodega.mockRejectedValue(new ForbiddenException('No tenés acceso a la sucursal de esta bodega'));

      await expect(service.crear(dto(), 'tenant-1', 'vendedor-1')).rejects.toThrow(ForbiddenException);
      expect(repository.crearFacturaEnTx).not.toHaveBeenCalled();
    });
  });

  describe('resolución del nivel de precio (Fase 3b)', () => {
    it('usa GENERAL si el cliente no tiene lista asignada y no hay override', async () => {
      clientesService.buscarPorId.mockResolvedValue({ id: 'cliente-1', listaPrecio: null } as never);
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);

      await service.crear(dto(), 'tenant-1', 'vendedor-1');

      expect(repository.obtenerProductoConPrecioVigente).toHaveBeenCalledWith('prod-1', 'variante-1', 'GENERAL');
    });

    it('usa la lista del cliente cuando no hay override explícito en el dto', async () => {
      clientesService.buscarPorId.mockResolvedValue({ id: 'cliente-1', listaPrecio: { id: 'lp-1', nombre: 'Mayorista' } } as never);
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);

      await service.crear(dto(), 'tenant-1', 'vendedor-1');

      expect(repository.obtenerProductoConPrecioVigente).toHaveBeenCalledWith('prod-1', 'variante-1', 'Mayorista');
    });

    it('el override explícito del dto.listaPrecio tiene prioridad sobre la lista del cliente', async () => {
      clientesService.buscarPorId.mockResolvedValue({ id: 'cliente-1', listaPrecio: { id: 'lp-1', nombre: 'Mayorista' } } as never);
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);

      await service.crear(dto({ listaPrecio: 'Distribuidor' }), 'tenant-1', 'vendedor-1');

      expect(repository.obtenerProductoConPrecioVigente).toHaveBeenCalledWith('prod-1', 'variante-1', 'Distribuidor');
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

  describe('aplicaItbis (plan de integración Cuadre, ítem B-7)', () => {
    it('aplicaItbis: false fuerza 0% en esa línea sin importar producto.porcentajeItbis', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);

      await service.crear(dto({ lineas: [{ productoId: 'prod-1', cantidad: 2, aplicaItbis: false }] }), 'tenant-1', 'vendedor-1');

      // 2*100=200 subtotal; itbis 0 porque aplicaItbis: false; total = 200
      expect(repository.crearFacturaEnTx).toHaveBeenCalledWith(
        TX,
        expect.objectContaining({ subtotal: 200, itbis: 0, total: 200 }),
      );
    });

    it('sin aplicaItbis (u omitido) usa el porcentajeItbis normal del producto', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);

      await service.crear(dto({ lineas: [{ productoId: 'prod-1', cantidad: 2 }] }), 'tenant-1', 'vendedor-1');

      expect(repository.crearFacturaEnTx).toHaveBeenCalledWith(TX, expect.objectContaining({ itbis: 36 }));
    });
  });

  describe('plazoPagoDias (plan de integración Cuadre, ítem B-6)', () => {
    it('propaga plazoPagoDias a crearFacturaEnTx cuando viene en el DTO', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);

      await service.crear(dto({ tipoFactura: 'CREDITO', plazoPagoDias: 60 }), 'tenant-1', 'vendedor-1');

      expect(repository.crearFacturaEnTx).toHaveBeenCalledWith(TX, expect.objectContaining({ plazoPagoDias: 60 }));
    });

    it('sin plazoPagoDias en el DTO, lo manda undefined (Prisma cae al @default(30) del schema)', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);

      await service.crear(dto(), 'tenant-1', 'vendedor-1');

      expect(repository.crearFacturaEnTx).toHaveBeenCalledWith(TX, expect.objectContaining({ plazoPagoDias: undefined }));
    });
  });

  describe('leyFiscal (plan de integración Cuadre, ítem B-3)', () => {
    it('reduce el ITBIS efectivo del producto según porcentajeItbisAPagar (18%→1.8% con ley al 10%)', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue({
        ...producto(18, 100),
        leyFiscal: { porcentajeItbisAPagar: 10 },
      } as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);

      await service.crear(dto({ lineas: [{ productoId: 'prod-1', cantidad: 2 }] }), 'tenant-1', 'vendedor-1');

      // 2*100=200 subtotal; itbis efectivo 1.8% de 200 = 3.6
      const llamada = repository.crearFacturaEnTx.mock.calls[0][1] as { subtotal: number; itbis: number };
      expect(llamada.subtotal).toBe(200);
      expect(llamada.itbis).toBeCloseTo(3.6);
    });

    it('sin leyFiscal usa el porcentajeItbis normal del producto', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue({ ...producto(18, 100), leyFiscal: null } as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);

      await service.crear(dto({ lineas: [{ productoId: 'prod-1', cantidad: 2 }] }), 'tenant-1', 'vendedor-1');

      expect(repository.crearFacturaEnTx).toHaveBeenCalledWith(TX, expect.objectContaining({ itbis: 36 }));
    });

    it('aplicaItbis: false sigue ganando sobre la ley fiscal (0% se queda en 0%)', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue({
        ...producto(18, 100),
        leyFiscal: { porcentajeItbisAPagar: 10 },
      } as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);

      await service.crear(dto({ lineas: [{ productoId: 'prod-1', cantidad: 2, aplicaItbis: false }] }), 'tenant-1', 'vendedor-1');

      expect(repository.crearFacturaEnTx).toHaveBeenCalledWith(TX, expect.objectContaining({ itbis: 0 }));
    });
  });

  describe('descuentoGeneral (plan de integración Cuadre, ítem B-8)', () => {
    it('descuentoGeneralPct se reparte proporcionalmente entre las líneas (recalcula ITBIS)', async () => {
      repository.obtenerProductoConPrecioVigente
        .mockResolvedValueOnce(producto(18, 150) as never) // línea 1: 2*150=300
        .mockResolvedValueOnce(producto(18, 100) as never); // línea 2: 1*100=100
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);

      await service.crear(
        dto({
          descuentoGeneralPct: 10, // 10% de 400 = 40
          lineas: [
            { productoId: 'prod-1', cantidad: 2 },
            { productoId: 'prod-2', cantidad: 1 },
          ],
        }),
        'tenant-1',
        'vendedor-1',
      );

      const llamada = repository.crearFacturaEnTx.mock.calls[0][1] as { lineas: { descuento: number }[]; subtotal: number };
      expect(llamada.lineas[0].descuento).toBeCloseTo(30); // 300/400 * 40
      expect(llamada.lineas[1].descuento).toBeCloseTo(10); // 100/400 * 40
      expect(llamada.subtotal).toBeCloseTo(360); // 400 - 40
    });

    it('descuentoGeneralMonto aplica el monto fijo prorrateado', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);

      await service.crear(dto({ descuentoGeneralMonto: 20, lineas: [{ productoId: 'prod-1', cantidad: 2 }] }), 'tenant-1', 'vendedor-1');

      // 2*100=200 - 20 = 180 subtotal; itbis 18% de 180 = 32.4
      expect(repository.crearFacturaEnTx).toHaveBeenCalledWith(TX, expect.objectContaining({ subtotal: 180, itbis: 32.4 }));
    });

    it('se acumula con un descuento por línea existente, no lo reemplaza', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);

      await service.crear(
        dto({ descuentoGeneralMonto: 10, lineas: [{ productoId: 'prod-1', cantidad: 2, descuento: 5 }] }),
        'tenant-1',
        'vendedor-1',
      );

      const llamada = repository.crearFacturaEnTx.mock.calls[0][1] as { lineas: { descuento: number }[] };
      expect(llamada.lineas[0].descuento).toBeCloseTo(15); // 5 manual + 10 general
    });

    it('rechaza con 400 si vienen descuentoGeneralPct y descuentoGeneralMonto juntos', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);

      await expect(
        service.crear(dto({ descuentoGeneralPct: 10, descuentoGeneralMonto: 20 }), 'tenant-1', 'vendedor-1'),
      ).rejects.toThrow(BadRequestException);
      expect(repository.crearFacturaEnTx).not.toHaveBeenCalled();
    });

    it('una NOTA_CREDITO/NOTA_DEBITO nunca aplica descuento general (ajustan un monto ya facturado)', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);

      await service.crear(
        dto({ tipoFactura: 'NOTA_CREDITO', facturaOrigenId: 'f-orig', descuentoGeneralPct: 10, lineas: [{ productoId: 'prod-1', cantidad: 1 }] }),
        'tenant-1',
        'vendedor-1',
      );

      expect(repository.crearFacturaEnTx).toHaveBeenCalledWith(TX, expect.objectContaining({ subtotal: -100 }));
    });
  });

  describe('ofertas automáticas (Fase 4b)', () => {
    it('aplica el descuento automático de línea que resuelve OfertasService cuando la línea no trae descuento manual', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      ofertasService.resolverDescuentoLinea.mockResolvedValue(20);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);

      await service.crear(dto({ lineas: [{ productoId: 'prod-1', cantidad: 2 }] }), 'tenant-1', 'vendedor-1');

      // 2*100=200 - 20 descuento = 180 subtotal; itbis 18% de 180 = 32.4
      expect(repository.crearFacturaEnTx).toHaveBeenCalledWith(
        TX,
        expect.objectContaining({ subtotal: 180, itbis: 32.4, descuento: 20 }),
      );
    });

    it('un descuento manual explícito en la línea evita que se resuelva el automático', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);

      await service.crear(dto({ lineas: [{ productoId: 'prod-1', cantidad: 2, descuento: 5 }] }), 'tenant-1', 'vendedor-1');

      expect(ofertasService.resolverDescuentoLinea).not.toHaveBeenCalled();
      expect(repository.crearFacturaEnTx).toHaveBeenCalledWith(TX, expect.objectContaining({ descuento: 5 }));
    });

    it('un descuento de carrito se reparte proporcionalmente entre las líneas (ITBIS recalculado por línea)', async () => {
      repository.obtenerProductoConPrecioVigente
        .mockResolvedValueOnce(producto(18, 150) as never) // línea 1: 2*150=300
        .mockResolvedValueOnce(producto(18, 100) as never); // línea 2: 1*100=100
      ofertasService.resolverDescuentoCarritoTotal.mockResolvedValue(40); // 10% de 400
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);

      await service.crear(
        dto({
          lineas: [
            { productoId: 'prod-1', cantidad: 2 },
            { productoId: 'prod-2', cantidad: 1 },
          ],
        }),
        'tenant-1',
        'vendedor-1',
      );

      expect(ofertasService.resolverDescuentoCarritoTotal).toHaveBeenCalledWith(400);
      const llamada = repository.crearFacturaEnTx.mock.calls[0][1] as { lineas: { descuento: number }[]; subtotal: number };
      expect(llamada.lineas[0].descuento).toBeCloseTo(30); // 300/400 * 40
      expect(llamada.lineas[1].descuento).toBeCloseTo(10); // 100/400 * 40
      expect(llamada.subtotal).toBeCloseTo(360); // 400 - 40
    });

    it('una NOTA_CREDITO/NOTA_DEBITO nunca resuelve ofertas automáticas (ajustan un monto ya facturado, no una venta nueva)', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada({ tipoFactura: 'NOTA_CREDITO' }) as never);

      await service.crear(
        dto({ tipoFactura: 'NOTA_CREDITO', facturaOrigenId: 'f-origen', lineas: [{ productoId: 'prod-1', cantidad: 1 }] }),
        'tenant-1',
        'vendedor-1',
      );

      expect(ofertasService.resolverDescuentoLinea).not.toHaveBeenCalled();
      expect(ofertasService.resolverDescuentoCarritoTotal).not.toHaveBeenCalled();
    });
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

    expect(repository.siguienteNcfEnTx).toHaveBeenCalledWith(TX, tipoNcfEsperado, 's1');
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

    expect(repository.siguienteNcfEnTx).toHaveBeenCalledWith(TX, tipoEcfEsperado, 's1');
  });

  describe('tipoComprobanteEspecial (plan de integración Cuadre, ítem B-1)', () => {
    it.each([
      ['REGIMEN_ESPECIAL', 'B14'],
      ['GUBERNAMENTAL', 'B15'],
    ])('%s en una venta CONTADO usa %s en vez del NCF normal', async (tipoComprobanteEspecial, tipoNcfEsperado) => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);

      await service.crear(
        dto({ tipoFactura: 'CONTADO', tipoComprobanteEspecial: tipoComprobanteEspecial as never }),
        'tenant-1',
        'vendedor-1',
      );

      expect(repository.siguienteNcfEnTx).toHaveBeenCalledWith(TX, tipoNcfEsperado, 's1');
    });

    it.each([
      ['REGIMEN_ESPECIAL', 'E44'],
      ['GUBERNAMENTAL', 'E45'],
    ])('%s en modalidad ECF usa %s en vez del e-NCF normal', async (tipoComprobanteEspecial, tipoEcfEsperado) => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.obtenerModalidadFacturacion.mockResolvedValue('ECF' as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);

      await service.crear(
        dto({ tipoFactura: 'CREDITO', tipoComprobanteEspecial: tipoComprobanteEspecial as never }),
        'tenant-1',
        'vendedor-1',
      );

      expect(repository.siguienteNcfEnTx).toHaveBeenCalledWith(TX, tipoEcfEsperado, 's1');
    });

    it('se ignora en una Nota de Crédito — siempre usa B04, nunca un tipo especial', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada({ id: 'nc1', total: -118 }) as never);

      await service.crear(
        dto({ tipoFactura: 'NOTA_CREDITO', facturaOrigenId: 'f-original', tipoComprobanteEspecial: 'GUBERNAMENTAL' as never }),
        'tenant-1',
        'vendedor-1',
      );

      expect(repository.siguienteNcfEnTx).toHaveBeenCalledWith(TX, 'B04', 's1');
    });
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
    expect(repository.siguienteNcfEnTx).toHaveBeenCalledWith(TX, expect.anything(), 's1');
    expect(repository.crearFacturaEnTx).toHaveBeenCalledWith(TX, expect.anything());
  });

  describe('umbral de alerta de NCF (plan de integración Cuadre, ítem B-2)', () => {
    it('emite NCF_POR_AGOTARSE cuando los comprobantes restantes caen al umbral configurado o menos', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);
      repository.siguienteNcfEnTx.mockResolvedValue({ ncf: 'B0200000001', restantes: 5, umbralAlerta: 10, sucursalIdUsado: 's1' } as never);

      await service.crear(dto(), 'tenant-1', 'vendedor-1');

      expect(eventBus.emit).toHaveBeenCalledWith(
        EVENTOS.NCF_POR_AGOTARSE,
        expect.objectContaining({ tenantId: 'tenant-1', tipoNcf: 'B02', sucursalId: 's1', restantes: 5, umbralAlerta: 10 }),
      );
    });

    it('no emite nada si no hay umbralAlerta configurado', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);
      repository.siguienteNcfEnTx.mockResolvedValue({ ncf: 'B0200000001', restantes: 5, umbralAlerta: null, sucursalIdUsado: 's1' } as never);

      await service.crear(dto(), 'tenant-1', 'vendedor-1');

      expect(eventBus.emit).not.toHaveBeenCalledWith(EVENTOS.NCF_POR_AGOTARSE, expect.anything());
    });

    it('no emite nada si los restantes todavía están por encima del umbral', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);
      repository.siguienteNcfEnTx.mockResolvedValue({ ncf: 'B0200000001', restantes: 50, umbralAlerta: 10, sucursalIdUsado: 's1' } as never);

      await service.crear(dto(), 'tenant-1', 'vendedor-1');

      expect(eventBus.emit).not.toHaveBeenCalledWith(EVENTOS.NCF_POR_AGOTARSE, expect.anything());
    });
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

  describe('canje de Bono (Fase 4c)', () => {
    it('llama BonosService.procesarPagoEnTx una vez por cada pago, antes de tocar inventario', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada({ total: 236 }) as never);

      await service.crear(dto(), 'tenant-1', 'vendedor-1', {
        pagos: [
          { formaPagoId: 'fp-bono', monto: 200, referencia: 'BONO-AAAAAAAA' },
          { formaPagoId: 'fp-efectivo', monto: 36 },
        ],
      });

      expect(bonosService.procesarPagoEnTx).toHaveBeenCalledTimes(2);
      expect(bonosService.procesarPagoEnTx).toHaveBeenCalledWith(TX, 'tenant-1', { formaPagoId: 'fp-bono', monto: 200, referencia: 'BONO-AAAAAAAA' });
      const ordenBono = bonosService.procesarPagoEnTx.mock.invocationCallOrder[0];
      const ordenStock = inventarioService.verificarYDescontarStockEnTx.mock.invocationCallOrder[0];
      expect(ordenBono).toBeLessThan(ordenStock);
    });

    it('si BonosService.procesarPagoEnTx rechaza (código inválido/saldo insuficiente), no crea la factura', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      bonosService.procesarPagoEnTx.mockRejectedValueOnce(new BadRequestException('El bono no tiene saldo suficiente'));

      await expect(
        service.crear(dto(), 'tenant-1', 'vendedor-1', { pagos: [{ formaPagoId: 'fp-bono', monto: 236, referencia: 'BONO-X' }] }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.crearFacturaEnTx).not.toHaveBeenCalled();
    });
  });

  describe('cotizar (Fase 4c, previsualización sin efectos secundarios — gap Ofertas+POS)', () => {
    it('resuelve el mismo total que crear() incluyendo el descuento automático de ofertas', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      ofertasService.resolverDescuentoLinea.mockResolvedValue(20);

      const resultado = await service.cotizar({ clienteId: 'cliente-1', lineas: [{ productoId: 'prod-1', cantidad: 2 }] });

      // 2*100=200 - 20 descuento = 180 subtotal; itbis 18% de 180 = 32.4
      expect(resultado).toEqual(expect.objectContaining({ subtotal: 180, itbis: 32.4, descuento: 20, total: 212.4 }));
    });

    it('no abre transacción ni toca stock/NCF/pagos', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);

      await service.cotizar({ clienteId: 'cliente-1', lineas: [{ productoId: 'prod-1', cantidad: 1 }] });

      expect(tenantPrisma.client.$transaction).not.toHaveBeenCalled();
      expect(inventarioService.verificarYDescontarStockEnTx).not.toHaveBeenCalled();
      expect(repository.siguienteNcfEnTx).not.toHaveBeenCalled();
      expect(repository.crearFacturaEnTx).not.toHaveBeenCalled();
      expect(bonosService.procesarPagoEnTx).not.toHaveBeenCalled();
    });
  });

  describe('permiteDevolucion (plan de integración Cuadre, ítem E-8)', () => {
    it('rechaza con 400 una NOTA_CREDITO que incluya un producto con permiteDevolucion:false', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue({ ...producto(18, 100), permiteDevolucion: false } as never);

      await expect(
        service.crear(dto({ tipoFactura: 'NOTA_CREDITO', facturaOrigenId: 'f-original' }), 'tenant-1', 'vendedor-1'),
      ).rejects.toThrow(BadRequestException);
      expect(repository.crearFacturaEnTx).not.toHaveBeenCalled();
    });

    it('permite una venta normal (CONTADO) del mismo producto con permiteDevolucion:false', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue({ ...producto(18, 100), permiteDevolucion: false } as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);

      await service.crear(dto(), 'tenant-1', 'vendedor-1');

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

  describe('vencimientos por lote (Fase 5b)', () => {
    it('la venta pasa referenciaTipo/referenciaId — el mismo id con el que se crea la factura — al descuento de stock', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada() as never);

      await service.crear(dto(), 'tenant-1', 'vendedor-1');

      const argsDescuento = inventarioService.verificarYDescontarStockEnTx.mock.calls[0][1];
      const argsCrearFactura = repository.crearFacturaEnTx.mock.calls[0][1];
      expect(argsDescuento.referenciaTipo).toBe('FACTURA');
      expect(argsCrearFactura.id).toEqual(expect.any(String));
      expect(argsDescuento.referenciaId).toBe(argsCrearFactura.id);
    });

    it('NOTA_CREDITO de un producto que controla vencimiento reconstruye sola los lotes de la venta original', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue({ ...producto(18, 100), controlaVencimiento: true } as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada({ id: 'nc1' }) as never);
      inventarioService.reconstruirLotesDeVentaEnTx.mockResolvedValue([
        { numeroLote: 'L1', fechaVencimiento: new Date('2026-09-01'), cantidad: 2 },
      ] as never);

      await service.crear(
        dto({ tipoFactura: 'NOTA_CREDITO', facturaOrigenId: 'f-original', lineas: [{ productoId: 'prod-1', cantidad: 2 }] }),
        'tenant-1',
        'vendedor-1',
      );

      expect(inventarioService.reconstruirLotesDeVentaEnTx).toHaveBeenCalledWith(TX, 'f-original', 'variante-1', 2);
      expect(inventarioService.entradaStockEnTx).toHaveBeenCalledWith(
        TX,
        expect.objectContaining({
          referenciaTipo: 'FACTURA',
          lotes: [{ numeroLote: 'L1', fechaVencimiento: new Date('2026-09-01'), cantidad: 2 }],
        }),
      );
    });

    it('NOTA_CREDITO de un producto SIN controlaVencimiento no intenta reconstruir lotes', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearFacturaEnTx.mockResolvedValue(facturaCreada({ id: 'nc1' }) as never);

      await service.crear(dto({ tipoFactura: 'NOTA_CREDITO', facturaOrigenId: 'f-original' }), 'tenant-1', 'vendedor-1');

      expect(inventarioService.reconstruirLotesDeVentaEnTx).not.toHaveBeenCalled();
      expect(inventarioService.entradaStockEnTx).toHaveBeenCalledWith(TX, expect.objectContaining({ lotes: undefined }));
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

    it('Fase 9: propaga el PIN incorrecto/faltante sin llegar a tocar la factura', async () => {
      authService.verificarPin.mockRejectedValue(new Error('PIN incorrecto'));

      await expect(service.anular('f1', 'Motivo de prueba', 'tenant-1', 'user-1', true, 'mal')).rejects.toThrow('PIN incorrecto');
      expect(repository.buscarPorId).not.toHaveBeenCalled();
    });

    it('Fase 9: valida acceso a la sucursal de la bodega de la factura antes de anular', async () => {
      repository.buscarPorId.mockResolvedValue(facturaExistente() as never);
      inventarioService.validarAccesoBodega.mockRejectedValue(new ForbiddenException('No tenés acceso a la sucursal de esta bodega'));

      await expect(service.anular('f1', 'Motivo de prueba', 'tenant-1', 'user-1', true)).rejects.toThrow(ForbiddenException);
      expect(inventarioService.validarAccesoBodega).toHaveBeenCalledWith('bodega-1', 'user-1');
      expect(repository.anularEnTx).not.toHaveBeenCalled();
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

  describe('enviarRecibo (plan de integración Cuadre, ítem F-4)', () => {
    function facturaParaEnviar() {
      return {
        id: 'f1',
        ncf: 'B0200000001',
        fecha: new Date('2026-01-15'),
        cliente: { nombre: 'Cliente Demo' },
        total: 236,
      };
    }

    it('usa el destinatario del dto, no el email/teléfono guardado del cliente', async () => {
      repository.buscarPorId.mockResolvedValue(facturaParaEnviar() as never);

      await service.enviarRecibo('f1', { canal: 'EMAIL', destinatario: 'otra-persona@ejemplo.com' }, 'tenant-1');

      expect(notificacionesService.enviar).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-1', canal: 'EMAIL', clave: 'factura_recibo', destinatario: 'otra-persona@ejemplo.com' }),
      );
    });

    it('arma las variables de la plantilla con los datos de la factura', async () => {
      repository.buscarPorId.mockResolvedValue(facturaParaEnviar() as never);

      await service.enviarRecibo('f1', { canal: 'WHATSAPP', destinatario: '8095551234' }, 'tenant-1');

      const [[args]] = notificacionesService.enviar.mock.calls;
      expect(args.variables).toEqual(
        expect.objectContaining({ cliente_nombre: 'Cliente Demo', factura_ncf: 'B0200000001', factura_total: '236' }),
      );
    });

    it('devuelve enviado:false si el tenant no tiene una plantilla activa para ese canal', async () => {
      repository.buscarPorId.mockResolvedValue(facturaParaEnviar() as never);
      notificacionesService.enviar.mockResolvedValue(null as never);

      const resultado = await service.enviarRecibo('f1', { canal: 'EMAIL', destinatario: 'x@x.com' }, 'tenant-1');

      expect(resultado).toEqual({ enviado: false });
    });
  });

  describe('listar', () => {
    it('pasa tipoFactura al repositorio como tiposFactura — usado por la pantalla de Notas de Crédito/Débito (Fase 4a)', async () => {
      repository.listar.mockResolvedValue([[], 0]);

      await service.listar({ tipoFactura: ['NOTA_CREDITO', 'NOTA_DEBITO'] } as never);

      expect(repository.listar).toHaveBeenCalledWith(
        expect.objectContaining({ tiposFactura: ['NOTA_CREDITO', 'NOTA_DEBITO'] }),
      );
    });

    it('no manda tiposFactura si el query no lo trae (listado normal de facturas)', async () => {
      repository.listar.mockResolvedValue([[], 0]);

      await service.listar({} as never);

      expect(repository.listar).toHaveBeenCalledWith(expect.objectContaining({ tiposFactura: undefined }));
    });
  });
});
