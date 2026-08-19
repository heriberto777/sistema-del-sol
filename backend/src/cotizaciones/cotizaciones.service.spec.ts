import { BadRequestException } from '@nestjs/common';
import { CotizacionesService } from './cotizaciones.service';
import { CotizacionesRepository } from './cotizaciones.repository';
import { FacturacionService } from '../facturacion/facturacion.service';
import { ClientesService } from '../clientes/clientes.service';
import { VariantesService } from '../variantes/variantes.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { CrearCotizacionDto } from './dto/crear-cotizacion.dto';
import { PrismaService } from '../prisma/prisma.service';

describe('CotizacionesService', () => {
  let service: CotizacionesService;
  let repository: jest.Mocked<CotizacionesRepository>;
  let facturacionService: jest.Mocked<FacturacionService>;
  let clientesService: jest.Mocked<ClientesService>;
  let variantesService: jest.Mocked<VariantesService>;
  let eventBus: jest.Mocked<EventBusService>;
  let prisma: jest.Mocked<PrismaService>;

  const producto = (porcentajeItbis: number, precioVenta: number) => ({
    precios: [{ precioVenta }],
    porcentajeItbis,
  });

  beforeEach(() => {
    repository = {
      obtenerProductoConPrecioVigente: jest.fn(),
      crear: jest.fn(),
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
    eventBus = { emit: jest.fn(), on: jest.fn() } as unknown as jest.Mocked<EventBusService>;
    prisma = {
      bodega: { findFirst: jest.fn().mockResolvedValue(null) },
      configuracion: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as jest.Mocked<PrismaService>;
    service = new CotizacionesService(repository, facturacionService, clientesService, variantesService, eventBus, prisma);
  });

  function dto(overrides: Partial<CrearCotizacionDto> = {}): CrearCotizacionDto {
    return {
      numero: 'COT-001',
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
      repository.crear.mockResolvedValue({ id: 'c1' } as never);

      await service.crear(dto(), 'tenant-1', 'vendedor-1');

      expect(repository.obtenerProductoConPrecioVigente).toHaveBeenCalledWith('prod-1', 'variante-1', 'GENERAL');
    });

    it('usa la lista del cliente cuando no hay override explícito en el dto', async () => {
      clientesService.buscarPorId.mockResolvedValue({ id: 'cliente-1', listaPrecio: { id: 'lp-1', nombre: 'Mayorista' } } as never);
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crear.mockResolvedValue({ id: 'c1' } as never);

      await service.crear(dto(), 'tenant-1', 'vendedor-1');

      expect(repository.obtenerProductoConPrecioVigente).toHaveBeenCalledWith('prod-1', 'variante-1', 'Mayorista');
    });

    it('el override explícito del dto.listaPrecio tiene prioridad sobre la lista del cliente', async () => {
      clientesService.buscarPorId.mockResolvedValue({ id: 'cliente-1', listaPrecio: { id: 'lp-1', nombre: 'Mayorista' } } as never);
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crear.mockResolvedValue({ id: 'c1' } as never);

      await service.crear(dto({ listaPrecio: 'Distribuidor' }), 'tenant-1', 'vendedor-1');

      expect(repository.obtenerProductoConPrecioVigente).toHaveBeenCalledWith('prod-1', 'variante-1', 'Distribuidor');
    });
  });

  describe('crear', () => {
    it('calcula subtotal/itbis/total usando el precio vigente del producto', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 150) as never);
      repository.crear.mockResolvedValue({ id: 'c1' } as never);

      await service.crear(dto(), 'tenant-1', 'vendedor-1');

      // 2 * 150 = 300 subtotal; itbis 18% = 54
      expect(repository.crear).toHaveBeenCalledWith(
        expect.objectContaining({ subtotal: 300, itbis: 54, total: 354, tenantId: 'tenant-1', vendedorId: 'vendedor-1' }),
      );
    });

    it('no toca inventario ni FacturacionService al crear (documento sin efecto fiscal)', async () => {
      repository.obtenerProductoConPrecioVigente.mockResolvedValue(producto(18, 100) as never);
      repository.crear.mockResolvedValue({ id: 'c1' } as never);

      await service.crear(dto(), 'tenant-1', 'vendedor-1');

      expect(facturacionService.crear).not.toHaveBeenCalled();
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

      await service.actualizar('c1', dto({ numero: 'COT-002', lineas: [{ productoId: 'prod-1', cantidad: 1 }] }));

      expect(repository.actualizar).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({ numero: 'COT-002', subtotal: 200, itbis: 36, total: 236 }),
      );
    });

    it('rechaza editar una cotización que ya no está en BORRADOR', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'c1', estado: 'ENVIADA', facturaId: null } as never);

      await expect(service.actualizar('c1', dto())).rejects.toThrow(BadRequestException);
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
