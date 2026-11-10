import { BadRequestException } from '@nestjs/common';
import { FacturasProveedorService } from './facturas-proveedor.service';
import { FacturasProveedorRepository } from './facturas-proveedor.repository';
import { CuentasPorPagarRepository } from '../cuentas-por-pagar/cuentas-por-pagar.repository';
import { ProveedoresService } from '../proveedores/proveedores.service';
import { TerminosPagoService } from '../terminos-pago/terminos-pago.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { CierrePeriodoService } from '../contabilidad/cierre-periodo.service';
import { PagosService } from '../pagos/pagos.service';
import { ExtractorFacturaService } from '../ia/extractor-factura/extractor-factura.service';
import { UsoIaService } from '../ia/uso-ia.service';

describe('FacturasProveedorService', () => {
  let service: FacturasProveedorService;
  let repository: jest.Mocked<FacturasProveedorRepository>;
  let cuentasPorPagarRepository: jest.Mocked<CuentasPorPagarRepository>;
  let proveedoresService: jest.Mocked<ProveedoresService>;
  let terminosPagoService: jest.Mocked<TerminosPagoService>;
  let tenantPrisma: { client: { $transaction: jest.Mock } };
  let eventBus: jest.Mocked<EventBusService>;
  let cierrePeriodoService: jest.Mocked<CierrePeriodoService>;
  let pagosService: jest.Mocked<PagosService>;
  let extractorFacturaService: jest.Mocked<ExtractorFacturaService>;
  let usoIaService: jest.Mocked<UsoIaService>;

  const TX = { esTransaccion: true };

  beforeEach(() => {
    repository = {
      crearEnTx: jest.fn(),
      listar: jest.fn(),
      buscarPorId: jest.fn(),
      buscarPorIdOrThrow: jest.fn(),
      anularEnTx: jest.fn(),
    } as unknown as jest.Mocked<FacturasProveedorRepository>;
    cuentasPorPagarRepository = {
      crearEnTx: jest.fn(),
      reducirPorNotaCreditoEnTx: jest.fn(),
      anularPorFacturaProveedorEnTx: jest.fn(),
    } as unknown as jest.Mocked<CuentasPorPagarRepository>;
    proveedoresService = { buscarPorId: jest.fn().mockResolvedValue({ id: 'prov-1', plazoPagoDias: 30 }) } as unknown as jest.Mocked<ProveedoresService>;
    terminosPagoService = { buscarPorId: jest.fn() } as unknown as jest.Mocked<TerminosPagoService>;
    tenantPrisma = { client: { $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(TX)) } };
    eventBus = { emit: jest.fn(), on: jest.fn() } as unknown as jest.Mocked<EventBusService>;
    cierrePeriodoService = { validarFechaAbierta: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<CierrePeriodoService>;
    pagosService = {
      registrarPagoFacturaProveedor: jest.fn(),
      listarPorFacturaProveedor: jest.fn(),
    } as unknown as jest.Mocked<PagosService>;
    extractorFacturaService = { extraerDesdeDataUri: jest.fn() } as unknown as jest.Mocked<ExtractorFacturaService>;
    usoIaService = { verificarYRegistrar: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<UsoIaService>;

    service = new FacturasProveedorService(
      repository,
      cuentasPorPagarRepository,
      proveedoresService,
      terminosPagoService,
      tenantPrisma as unknown as TenantPrismaService,
      eventBus,
      cierrePeriodoService,
      pagosService,
      extractorFacturaService,
      usoIaService,
    );
  });

  function dto(overrides: Partial<Parameters<FacturasProveedorService['crear']>[0]> = {}) {
    return {
      proveedorId: 'prov-1',
      ncfProveedor: 'B0100000001',
      tipoNcfProveedor: 'B01',
      lineas: [{ cuentaContableId: 'gasto-1', valor: 100, porcentajeItbis: 18, cantidad: 2 }],
      ...overrides,
    } as Parameters<FacturasProveedorService['crear']>[0];
  }

  describe('crear — tipo FACTURA', () => {
    it('calcula subtotal/itbis/total agregando las líneas (valor * cantidad * %)', async () => {
      repository.crearEnTx.mockResolvedValue({ id: 'fp1' } as never);

      await service.crear(dto(), 'tenant-1', 'user-1');

      // 100 * 2 = 200 base; itbis 18% de 200 = 36; total = 236
      expect(repository.crearEnTx).toHaveBeenCalledWith(
        TX,
        expect.objectContaining({ subtotal: 200, itbis: 36, total: 236, tipo: 'FACTURA' }),
      );
    });

    it('crea la CuentaPorPagar dentro de la misma transacción, con facturaProveedorId', async () => {
      repository.crearEnTx.mockResolvedValue({ id: 'fp1' } as never);

      await service.crear(dto(), 'tenant-1', 'user-1');

      expect(cuentasPorPagarRepository.crearEnTx).toHaveBeenCalledWith(
        TX,
        expect.objectContaining({ facturaProveedorId: 'fp1', monto: 236 }),
      );
    });

    it('usa el plazoPagoDias del proveedor si no se indica terminoPagoId', async () => {
      repository.crearEnTx.mockResolvedValue({ id: 'fp1' } as never);

      await service.crear(dto({ fecha: '2026-01-01' }), 'tenant-1', 'user-1');

      const llamada = cuentasPorPagarRepository.crearEnTx.mock.calls[0][1] as { fechaVencimiento: Date };
      expect(llamada.fechaVencimiento.toISOString().slice(0, 10)).toBe('2026-01-31');
    });

    it('emite FACTURA_PROVEEDOR_CREADA tras crearla', async () => {
      repository.crearEnTx.mockResolvedValue({ id: 'fp1' } as never);

      await service.crear(dto(), 'tenant-1', 'user-1');

      expect(eventBus.emit).toHaveBeenCalledWith(EVENTOS.FACTURA_PROVEEDOR_CREADA, { tenantId: 'tenant-1', facturaProveedorId: 'fp1' });
    });

    it('rechaza una factura fechada en un período contable ya cerrado', async () => {
      cierrePeriodoService.validarFechaAbierta.mockRejectedValue(new BadRequestException('cerrado'));

      await expect(service.crear(dto({ fecha: '2026-01-01' }), 'tenant-1', 'user-1')).rejects.toThrow(BadRequestException);
      expect(repository.crearEnTx).not.toHaveBeenCalled();
    });

    it('proveedor de otro tenant — 404 propagado desde ProveedoresService (tenant-scoped)', async () => {
      proveedoresService.buscarPorId.mockRejectedValue(new Error('no encontrado'));

      await expect(service.crear(dto(), 'tenant-1', 'user-1')).rejects.toThrow('no encontrado');
      expect(repository.crearEnTx).not.toHaveBeenCalled();
    });
  });

  describe('crear — tipo NOTA_CREDITO', () => {
    function facturaOrigen(overrides: Record<string, unknown> = {}) {
      return {
        id: 'fp-origen',
        proveedorId: 'prov-1',
        tipo: 'FACTURA',
        estado: 'EMITIDA',
        cuentaPorPagar: { id: 'cxp-1', saldo: 236 },
        ...overrides,
      };
    }

    it('exige facturaOrigenId', async () => {
      await expect(service.crear(dto({ tipo: 'NOTA_CREDITO' }), 'tenant-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('rechaza si la factura origen es de otro proveedor', async () => {
      repository.buscarPorId.mockResolvedValue(facturaOrigen({ proveedorId: 'otro-proveedor' }) as never);

      await expect(
        service.crear(dto({ tipo: 'NOTA_CREDITO', facturaOrigenId: 'fp-origen' }), 'tenant-1', 'user-1'),
      ).rejects.toThrow('no pertenece a este proveedor');
    });

    it('rechaza si la factura origen ya es una NOTA_CREDITO', async () => {
      repository.buscarPorId.mockResolvedValue(facturaOrigen({ tipo: 'NOTA_CREDITO' }) as never);

      await expect(
        service.crear(dto({ tipo: 'NOTA_CREDITO', facturaOrigenId: 'fp-origen' }), 'tenant-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si la factura origen está anulada', async () => {
      repository.buscarPorId.mockResolvedValue(facturaOrigen({ estado: 'ANULADA' }) as never);

      await expect(
        service.crear(dto({ tipo: 'NOTA_CREDITO', facturaOrigenId: 'fp-origen' }), 'tenant-1', 'user-1'),
      ).rejects.toThrow('anulada');
    });

    it('rechaza si el total de la nota excede el saldo pendiente de la factura origen', async () => {
      repository.buscarPorId.mockResolvedValue(facturaOrigen({ cuentaPorPagar: { id: 'cxp-1', saldo: 50 } }) as never);

      await expect(
        service.crear(dto({ tipo: 'NOTA_CREDITO', facturaOrigenId: 'fp-origen' }), 'tenant-1', 'user-1'),
      ).rejects.toThrow('excede el saldo pendiente');
      expect(repository.crearEnTx).not.toHaveBeenCalled();
    });

    it('reduce la CuentaPorPagar de la factura origen, sin crear una propia', async () => {
      repository.buscarPorId.mockResolvedValue(facturaOrigen() as never);
      repository.crearEnTx.mockResolvedValue({ id: 'nc-1' } as never);

      await service.crear(dto({ tipo: 'NOTA_CREDITO', facturaOrigenId: 'fp-origen' }), 'tenant-1', 'user-1');

      expect(cuentasPorPagarRepository.reducirPorNotaCreditoEnTx).toHaveBeenCalledWith(TX, 'cxp-1', 236);
      expect(cuentasPorPagarRepository.crearEnTx).not.toHaveBeenCalled();
    });
  });

  describe('anular', () => {
    it('anula una FACTURA sin pagos aplicados', async () => {
      repository.buscarPorIdOrThrow.mockResolvedValue({
        id: 'fp1',
        tipo: 'FACTURA',
        estado: 'EMITIDA',
        cuentaPorPagar: { saldo: 236, monto: 236 },
      } as never);

      await service.anular('fp1');

      expect(cuentasPorPagarRepository.anularPorFacturaProveedorEnTx).toHaveBeenCalledWith(TX, 'fp1');
      expect(repository.anularEnTx).toHaveBeenCalledWith(TX, 'fp1');
    });

    it('rechaza anular si ya tiene pagos aplicados (saldo != monto)', async () => {
      repository.buscarPorIdOrThrow.mockResolvedValue({
        id: 'fp1',
        tipo: 'FACTURA',
        estado: 'EMITIDA',
        cuentaPorPagar: { saldo: 100, monto: 236 },
      } as never);

      await expect(service.anular('fp1')).rejects.toThrow('ya tiene pagos aplicados');
    });

    it('rechaza anular una NOTA_CREDITO (no se puede anular una vez creada)', async () => {
      repository.buscarPorIdOrThrow.mockResolvedValue({ id: 'nc1', tipo: 'NOTA_CREDITO', estado: 'EMITIDA' } as never);

      await expect(service.anular('nc1')).rejects.toThrow('nota de crédito no se puede anular');
    });

    it('rechaza anular una factura ya anulada', async () => {
      repository.buscarPorIdOrThrow.mockResolvedValue({ id: 'fp1', tipo: 'FACTURA', estado: 'ANULADA' } as never);

      await expect(service.anular('fp1')).rejects.toThrow('ya está anulada');
    });
  });

  describe('registrarPago', () => {
    it('delega en PagosService.registrarPagoFacturaProveedor', async () => {
      repository.buscarPorIdOrThrow.mockResolvedValue({ id: 'fp1', proveedorId: 'prov-1', estado: 'EMITIDA', pagada: false } as never);

      await service.registrarPago('fp1', { monto: 100, formaPagoId: 'fp-1' } as never, 'user-1', 'tenant-1');

      expect(pagosService.registrarPagoFacturaProveedor).toHaveBeenCalledWith(
        { id: 'fp1', proveedorId: 'prov-1', estado: 'EMITIDA', pagada: false },
        { monto: 100, formaPagoId: 'fp-1' },
        'user-1',
        'tenant-1',
      );
    });

    it('rechaza registrar pago sobre una factura anulada', async () => {
      repository.buscarPorIdOrThrow.mockResolvedValue({ id: 'fp1', estado: 'ANULADA' } as never);

      await expect(service.registrarPago('fp1', {} as never, 'user-1', 'tenant-1')).rejects.toThrow('anulada');
    });

    it('rechaza registrar pago sobre una factura ya pagada', async () => {
      repository.buscarPorIdOrThrow.mockResolvedValue({ id: 'fp1', estado: 'EMITIDA', pagada: true } as never);

      await expect(service.registrarPago('fp1', {} as never, 'user-1', 'tenant-1')).rejects.toThrow('ya está pagada');
    });
  });

  it('listar delega en el repositorio con paginación', async () => {
    repository.listar.mockResolvedValue([[{ id: 'fp1' }], 1] as never);

    const resultado = await service.listar({ pagina: 1, tamanoPagina: 20 } as never);

    expect(resultado).toEqual({ datos: [{ id: 'fp1' }], total: 1, pagina: 1, tamanoPagina: 20 });
  });
});
