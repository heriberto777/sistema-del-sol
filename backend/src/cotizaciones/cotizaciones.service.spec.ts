import { BadRequestException } from '@nestjs/common';
import { CotizacionesService } from './cotizaciones.service';
import { CotizacionesRepository } from './cotizaciones.repository';
import { FacturacionService } from '../facturacion/facturacion.service';
import { ClientesService } from '../clientes/clientes.service';
import { VariantesService } from '../variantes/variantes.service';
import { OfertasService } from '../ofertas/ofertas.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { CrearCotizacionDto } from './dto/crear-cotizacion.dto';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CorrelativosRepository } from '../correlativos/correlativos.repository';
import { ConfiguracionesService } from '../configuraciones/configuraciones.service';

describe('CotizacionesService', () => {
  let service: CotizacionesService;
  let repository: jest.Mocked<CotizacionesRepository>;
  let facturacionService: jest.Mocked<FacturacionService>;
  let clientesService: jest.Mocked<ClientesService>;
  let variantesService: jest.Mocked<VariantesService>;
  let ofertasService: jest.Mocked<OfertasService>;
  let correlativosRepository: jest.Mocked<CorrelativosRepository>;
  let eventBus: jest.Mocked<EventBusService>;
  let prisma: jest.Mocked<PrismaService>;
  let tenantPrisma: { client: { $transaction: jest.Mock } };
  let configuracionesService: jest.Mocked<ConfiguracionesService>;

  // Ver el mismo patrón en compras.service.spec.ts/facturacion.service.spec.ts:
  // un tx opaco pasado por $transaction a los métodos *EnTx.
  const TX = { esTransaccion: true };

  const producto = (porcentajeItbis: number, precioVenta: number) => ({
    precios: [{ precioVenta }],
    porcentajeItbis,
  });

  beforeEach(() => {
    repository = {
      obtenerProductoConPrecioVigente: jest.fn(),
      crearEnTx: jest.fn(),
      buscarPorId: jest.fn(),
      listar: jest.fn(),
      actualizarEstado: jest.fn(),
      marcarConvertida: jest.fn(),
      actualizar: jest.fn(),
    } as unknown as jest.Mocked<CotizacionesRepository>;
    facturacionService = {
      crear: jest.fn(),
    } as unknown as jest.Mocked<FacturacionService>;
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
    correlativosRepository = { siguienteEnTx: jest.fn().mockResolvedValue('COT-00001') } as unknown as jest.Mocked<CorrelativosRepository>;
    eventBus = { emit: jest.fn(), on: jest.fn() } as unknown as jest.Mocked<EventBusService>;
    prisma = {
      bodega: { findFirst: jest.fn().mockResolvedValue(null) },
      configuracion: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as jest.Mocked<PrismaService>;
    tenantPrisma = { client: { $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(TX)) } };
    configuracionesService = { buscarValor: jest.fn().mockResolvedValue('18') } as unknown as jest.Mocked<ConfiguracionesService>;
    service = new CotizacionesService(
      repository,
      facturacionService,
      clientesService,
      variantesService,
      ofertasService,
      correlativosRepository,
      eventBus,
      prisma,
      tenantPrisma as unknown as TenantPrismaService,
      configuracionesService,
    );
  });

  function dto(overrides: Partial<CrearCotizacionDto> = {}): CrearCotizacionDto {
    return {
      clienteId: 'cliente-1',
      fechaVigenciaHasta: '2099-01-01',
      lineas: [{ productoId: 'prod-1', cantidad: 2 }],
      ...overrides,
    } as CrearCotizacionDto;
  }

  describe('resolución del nivel de precio (Fase 3b)', () => {
    it('usa GENERAL si el cliente no tiene lista asignada y no hay override', async () => {
      clientesService.buscarPorId.mockResolvedValue({ id: 'cliente-1', listaPrecio: null } as never);
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearEnTx.mockResolvedValue({ id: 'c1' } as never);

      await service.crear(dto(), 'tenant-1', 'vendedor-1');

      expect(repository.obtenerProductoConPrecioVigente).toHaveBeenCalledWith('prod-1', 'variante-1', 'GENERAL');
    });

    it('usa la lista del cliente cuando no hay override explícito en el dto', async () => {
      clientesService.buscarPorId.mockResolvedValue({ id: 'cliente-1', listaPrecio: { id: 'lp-1', nombre: 'Mayorista' } } as never);
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearEnTx.mockResolvedValue({ id: 'c1' } as never);

      await service.crear(dto(), 'tenant-1', 'vendedor-1');

      expect(repository.obtenerProductoConPrecioVigente).toHaveBeenCalledWith('prod-1', 'variante-1', 'Mayorista');
    });

    it('el override explícito del dto.listaPrecio tiene prioridad sobre la lista del cliente', async () => {
      clientesService.buscarPorId.mockResolvedValue({ id: 'cliente-1', listaPrecio: { id: 'lp-1', nombre: 'Mayorista' } } as never);
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearEnTx.mockResolvedValue({ id: 'c1' } as never);

      await service.crear(dto({ listaPrecio: 'Distribuidor' }), 'tenant-1', 'vendedor-1');

      expect(repository.obtenerProductoConPrecioVigente).toHaveBeenCalledWith('prod-1', 'variante-1', 'Distribuidor');
    });
  });

  describe('crear', () => {
    it('calcula subtotal/itbis/total usando el precio vigente del producto', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 150) as never);
      repository.crearEnTx.mockResolvedValue({ id: 'c1' } as never);

      await service.crear(dto(), 'tenant-1', 'vendedor-1');

      // 2 * 150 = 300 subtotal; itbis 18% = 54
      expect(repository.crearEnTx).toHaveBeenCalledWith(
        TX,
        expect.objectContaining({ subtotal: 300, itbis: 54, total: 354, tenantId: 'tenant-1', vendedorId: 'vendedor-1' }),
      );
    });

    it('no toca inventario ni FacturacionService al crear (documento sin efecto fiscal)', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearEnTx.mockResolvedValue({ id: 'c1' } as never);

      await service.crear(dto(), 'tenant-1', 'vendedor-1');

      expect(facturacionService.crear).not.toHaveBeenCalled();
    });

    it('consume el correlativo COTIZACION dentro de la misma transacción y usa ese número, no uno enviado por el cliente', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crearEnTx.mockResolvedValue({ id: 'c1' } as never);

      await service.crear(dto(), 'tenant-1', 'vendedor-1');

      expect(correlativosRepository.siguienteEnTx).toHaveBeenCalledWith(TX, 'tenant-1', 'COTIZACION');
      expect(repository.crearEnTx).toHaveBeenCalledWith(TX, expect.objectContaining({ numero: 'COT-00001' }));
    });
  });

  describe('ofertas automáticas (Fase 4b)', () => {
    it('una cotización ya muestra el descuento automático de línea (no solo al facturarla)', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      ofertasService.resolverDescuentoLinea.mockResolvedValue(20);
      repository.crearEnTx.mockResolvedValue({ id: 'c1' } as never);

      await service.crear(dto({ lineas: [{ productoId: 'prod-1', cantidad: 2 }] }), 'tenant-1', 'vendedor-1');

      // 2*100=200 - 20 descuento = 180 subtotal; itbis 18% de 180 = 32.4
      expect(repository.crearEnTx).toHaveBeenCalledWith(TX, expect.objectContaining({ subtotal: 180, itbis: 32.4, descuento: 20 }));
    });

    it('reparte un descuento de carrito proporcionalmente entre las líneas', async () => {
      repository.obtenerProductoConPrecioVigente
        .mockResolvedValueOnce(producto(18, 150) as never)
        .mockResolvedValueOnce(producto(18, 100) as never);
      ofertasService.resolverDescuentoCarritoTotal.mockResolvedValue(40);
      repository.crearEnTx.mockResolvedValue({ id: 'c1' } as never);

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
      const llamada = repository.crearEnTx.mock.calls[0][1] as { lineas: { descuento: number }[] };
      expect(llamada.lineas[0].descuento).toBeCloseTo(30);
      expect(llamada.lineas[1].descuento).toBeCloseTo(10);
    });
  });

  describe('buscarPorId / listar — vencimiento derivado', () => {
    it('marca como VENCIDA una cotización BORRADOR/ENVIADA cuya vigencia ya pasó', async () => {
      repository.buscarPorId.mockResolvedValue({
        id: 'c1',
        estado: 'ENVIADA',
        fechaVigenciaHasta: new Date('2000-01-01'),
      } as never);

      const resultado = await service.buscarPorId('c1');

      expect(resultado.estado).toBe('VENCIDA');
    });

    it('no marca como vencida una cotización ya ACEPTADA aunque la fecha haya pasado', async () => {
      repository.buscarPorId.mockResolvedValue({
        id: 'c1',
        estado: 'ACEPTADA',
        fechaVigenciaHasta: new Date('2000-01-01'),
      } as never);

      const resultado = await service.buscarPorId('c1');

      expect(resultado.estado).toBe('ACEPTADA');
    });

    it('no marca como vencida una cotización vigente', async () => {
      repository.buscarPorId.mockResolvedValue({
        id: 'c1',
        estado: 'ENVIADA',
        fechaVigenciaHasta: new Date('2099-01-01'),
      } as never);

      const resultado = await service.buscarPorId('c1');

      expect(resultado.estado).toBe('ENVIADA');
    });
  });

  describe('actualizar', () => {
    it('recalcula las líneas y reemplaza el contenido cuando la cotización está en BORRADOR', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'c1', estado: 'BORRADOR', facturaId: null } as never);
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 200) as never);
      repository.actualizar.mockResolvedValue({ id: 'c1' } as never);

      await service.actualizar('c1', dto({ lineas: [{ productoId: 'prod-1', cantidad: 1 }] }), 'tenant-1');

      expect(repository.actualizar).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({ subtotal: 200, itbis: 36, total: 236 }),
      );
    });

    it('rechaza editar una cotización que ya no está en BORRADOR', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'c1', estado: 'ENVIADA', facturaId: null } as never);

      await expect(service.actualizar('c1', dto(), 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(repository.actualizar).not.toHaveBeenCalled();
    });
  });

  describe('cambiarEstado', () => {
    it('rechaza cambiar el estado de una cotización ya convertida en factura', async () => {
      repository.buscarPorId.mockResolvedValue({ estado: 'ACEPTADA', facturaId: 'f1' } as never);

      await expect(service.cambiarEstado('c1', 'ENVIADA', 'tenant-1')).rejects.toThrow(BadRequestException);
    });

    it('rechaza cambiar el estado de una cotización rechazada', async () => {
      repository.buscarPorId.mockResolvedValue({ estado: 'RECHAZADA', facturaId: null } as never);

      await expect(service.cambiarEstado('c1', 'ENVIADA', 'tenant-1')).rejects.toThrow(BadRequestException);
    });

    it('permite cambiar el estado de una cotización abierta', async () => {
      repository.buscarPorId.mockResolvedValue({ estado: 'BORRADOR', facturaId: null, clienteId: 'cliente-1', numero: 'COT-001', total: 354 } as never);
      repository.actualizarEstado.mockResolvedValue({ id: 'c1', estado: 'ENVIADA' } as never);

      await service.cambiarEstado('c1', 'ENVIADA', 'tenant-1');

      expect(repository.actualizarEstado).toHaveBeenCalledWith('c1', 'ENVIADA');
    });

    it('emite COTIZACION_ENVIADA solo cuando el nuevo estado es ENVIADA', async () => {
      repository.buscarPorId.mockResolvedValue({ estado: 'BORRADOR', facturaId: null, clienteId: 'cliente-1', numero: 'COT-001', total: 354 } as never);
      repository.actualizarEstado.mockResolvedValue({ id: 'c1', estado: 'ENVIADA' } as never);

      await service.cambiarEstado('c1', 'ENVIADA', 'tenant-1');

      expect(eventBus.emit).toHaveBeenCalledWith(
        EVENTOS.COTIZACION_ENVIADA,
        expect.objectContaining({ tenantId: 'tenant-1', cotizacionId: 'c1', clienteId: 'cliente-1', numero: 'COT-001', total: '354' }),
      );
    });

    it('no emite ningún evento cuando el nuevo estado es ACEPTADA o RECHAZADA', async () => {
      repository.buscarPorId.mockResolvedValue({ estado: 'BORRADOR', facturaId: null, clienteId: 'cliente-1', numero: 'COT-001', total: 354 } as never);
      repository.actualizarEstado.mockResolvedValue({ id: 'c1', estado: 'RECHAZADA' } as never);

      await service.cambiarEstado('c1', 'RECHAZADA', 'tenant-1');

      expect(eventBus.emit).not.toHaveBeenCalled();
    });
  });

  describe('convertirEnFactura', () => {
    it('crea la factura con las líneas de la cotización y marca la cotización como convertida', async () => {
      repository.buscarPorId.mockResolvedValue({
        id: 'c1',
        estado: 'ACEPTADA',
        facturaId: null,
        clienteId: 'cliente-1',
        lineas: [{ productoId: 'prod-1', cantidad: 2, precioUnitario: 150, descuento: 0 }],
      } as never);
      facturacionService.crear.mockResolvedValue({ id: 'f1', total: 354 } as never);

      await service.convertirEnFactura('c1', { bodegaId: 'bodega-1', tipoFactura: 'CONTADO' }, 'tenant-1', 'vendedor-1');

      expect(facturacionService.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          clienteId: 'cliente-1',
          bodegaId: 'bodega-1',
          tipoFactura: 'CONTADO',
          lineas: [{ productoId: 'prod-1', cantidad: 2, precioUnitario: 150, descuento: 0 }],
        }),
        'tenant-1',
        'vendedor-1',
      );
      expect(repository.marcarConvertida).toHaveBeenCalledWith('c1', 'f1');
    });

    it('rechaza convertir una cotización ya convertida', async () => {
      repository.buscarPorId.mockResolvedValue({ estado: 'ACEPTADA', facturaId: 'f-existente' } as never);

      await expect(
        service.convertirEnFactura('c1', { bodegaId: 'bodega-1', tipoFactura: 'CONTADO' }, 'tenant-1', 'vendedor-1'),
      ).rejects.toThrow(BadRequestException);
      expect(facturacionService.crear).not.toHaveBeenCalled();
    });

    it('rechaza convertir una cotización rechazada', async () => {
      repository.buscarPorId.mockResolvedValue({ estado: 'RECHAZADA', facturaId: null } as never);

      await expect(
        service.convertirEnFactura('c1', { bodegaId: 'bodega-1', tipoFactura: 'CONTADO' }, 'tenant-1', 'vendedor-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('propaga una línea manual de la cotización a la factura (ítem B-9)', async () => {
      repository.buscarPorId.mockResolvedValue({
        id: 'c1',
        estado: 'ACEPTADA',
        facturaId: null,
        clienteId: 'cliente-1',
        lineas: [{ productoId: null, descripcionManual: 'Instalación', cantidad: 1, precioUnitario: 100, descuento: 0 }],
      } as never);
      facturacionService.crear.mockResolvedValue({ id: 'f1', total: 118 } as never);

      await service.convertirEnFactura('c1', { bodegaId: 'bodega-1', tipoFactura: 'CONTADO' }, 'tenant-1', 'vendedor-1');

      expect(facturacionService.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          lineas: [expect.objectContaining({ descripcionManual: 'Instalación', cantidad: 1, precioUnitario: 100 })],
        }),
        'tenant-1',
        'vendedor-1',
      );
    });
  });

  describe('línea manual/libre (plan de integración Cuadre, ítem B-9)', () => {
    it('calcula ITBIS a la tasa ITBIS_GENERAL del tenant, sin resolver producto/variante', async () => {
      repository.crearEnTx.mockResolvedValue({ id: 'c1' } as never);

      await service.crear(dto({ lineas: [{ descripcionManual: 'Instalación', cantidad: 1, precioUnitario: 100 } as never] }), 'tenant-1', 'vendedor-1');

      expect(variantesService.resolverObligatoria).not.toHaveBeenCalled();
      expect(repository.obtenerProductoConPrecioVigente).not.toHaveBeenCalled();
      expect(configuracionesService.buscarValor).toHaveBeenCalledWith('ITBIS_GENERAL', 'tenant-1', '18');
      expect(repository.crearEnTx).toHaveBeenCalledWith(
        TX,
        expect.objectContaining({
          subtotal: 100,
          itbis: 18,
          total: 118,
          lineas: [expect.objectContaining({ productoId: null, varianteId: null, descripcionManual: 'Instalación' })],
        }),
      );
    });

    it('rechaza una línea que trae productoId y descripcionManual a la vez', async () => {
      await expect(
        service.crear(dto({ lineas: [{ productoId: 'prod-1', descripcionManual: 'Instalación', cantidad: 1 } as never] }), 'tenant-1', 'vendedor-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('generarPdf', () => {
    it('genera un PDF a partir de la cotización y sus líneas', async () => {
      repository.buscarPorId.mockResolvedValue({
        id: 'c1',
        numero: 'COT-001',
        createdAt: new Date('2026-01-15'),
        cliente: { nombre: 'Cliente Demo' },
        subtotal: 200,
        descuento: 0,
        itbis: 36,
        total: 236,
        lineas: [{ producto: { nombre: 'Producto A' }, cantidad: 2, precioUnitario: 100, montoTotal: 236 }],
      } as never);

      const buffer = await service.generarPdf('c1');

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    });
  });
});
