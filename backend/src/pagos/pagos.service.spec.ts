import { BadRequestException } from '@nestjs/common';
import { PagosService } from './pagos.service';
import { PagosRepository } from './pagos.repository';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { CierrePeriodoService } from '../contabilidad/cierre-periodo.service';
import { FormasPagoRepository } from '../formas-pago/formas-pago.repository';

describe('PagosService', () => {
  let service: PagosService;
  let repository: jest.Mocked<PagosRepository>;
  let eventBus: jest.Mocked<EventBusService>;
  let cierrePeriodoService: jest.Mocked<CierrePeriodoService>;
  let formasPagoRepository: jest.Mocked<FormasPagoRepository>;

  beforeEach(() => {
    repository = {
      crear: jest.fn(),
      listarPorFactura: jest.fn(),
      listarPorOrdenCompra: jest.fn(),
      sumaPagosFactura: jest.fn().mockResolvedValue(0),
      sumaPagosOrdenCompra: jest.fn().mockResolvedValue(0),
      sumaPagosPorFacturas: jest.fn().mockResolvedValue([]),
      marcarFacturaPagada: jest.fn(),
      marcarOrdenCompraPagada: jest.fn(),
    } as unknown as jest.Mocked<PagosRepository>;
    eventBus = { emit: jest.fn(), on: jest.fn() } as unknown as jest.Mocked<EventBusService>;
    cierrePeriodoService = { validarFechaAbierta: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<CierrePeriodoService>;
    formasPagoRepository = { buscarPorId: jest.fn().mockResolvedValue({ id: 'fp1' }) } as unknown as jest.Mocked<FormasPagoRepository>;
    service = new PagosService(repository, eventBus, cierrePeriodoService, formasPagoRepository);
  });

  describe('registrarPagoFactura', () => {
    const factura = { id: 'f1', total: 500 };
    const dto = { monto: 200, formaPagoId: 'fp1' } as never;

    it('crea el pago y NO marca la factura como pagada si queda saldo pendiente', async () => {
      repository.sumaPagosFactura.mockResolvedValue(0);
      repository.crear.mockResolvedValue({ id: 'pago-1' } as never);

      await service.registrarPagoFactura(factura, dto, 'user-1', 'tenant-1');

      expect(repository.crear).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-1', facturaId: 'f1', monto: 200, formaPagoId: 'fp1', userId: 'user-1' }),
      );
      expect(repository.marcarFacturaPagada).not.toHaveBeenCalled();
    });

    it('marca la factura como pagada cuando la suma de pagos alcanza el total', async () => {
      repository.sumaPagosFactura.mockResolvedValue(300); // ya pagados 300 de 500
      repository.crear.mockResolvedValue({ id: 'pago-2' } as never);

      await service.registrarPagoFactura(factura, dto, 'user-1', 'tenant-1'); // +200 = 500

      expect(repository.marcarFacturaPagada).toHaveBeenCalledWith('f1', expect.any(Date));
    });

    it('rechaza un pago que excede el saldo pendiente', async () => {
      repository.sumaPagosFactura.mockResolvedValue(450); // pendiente = 50

      await expect(service.registrarPagoFactura(factura, dto, 'user-1', 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(repository.crear).not.toHaveBeenCalled();
    });

    it('emite PAGO_FACTURA_REGISTRADO con el monto pagado', async () => {
      repository.sumaPagosFactura.mockResolvedValue(0);
      repository.crear.mockResolvedValue({ id: 'pago-1' } as never);

      await service.registrarPagoFactura(factura, dto, 'user-1', 'tenant-1');

      expect(eventBus.emit).toHaveBeenCalledWith(
        EVENTOS.PAGO_FACTURA_REGISTRADO,
        expect.objectContaining({ tenantId: 'tenant-1', pagoId: 'pago-1', facturaId: 'f1', monto: '200' }),
      );
    });

    it('valida que formaPagoId pertenezca al tenant antes de registrar el pago', async () => {
      repository.sumaPagosFactura.mockResolvedValue(0);
      repository.crear.mockResolvedValue({ id: 'pago-1' } as never);

      await service.registrarPagoFactura(factura, dto, 'user-1', 'tenant-1');

      expect(formasPagoRepository.buscarPorId).toHaveBeenCalledWith('fp1');
    });
  });

  describe('registrarPagoOrdenCompra', () => {
    const orden = { id: 'oc-1', total: 1000 };
    const dto = { monto: 1000, formaPagoId: 'fp1' } as never;

    it('marca la orden como pagada cuando el pago cubre el total completo', async () => {
      repository.sumaPagosOrdenCompra.mockResolvedValue(0);
      repository.crear.mockResolvedValue({ id: 'pago-1' } as never);

      await service.registrarPagoOrdenCompra(orden, dto, 'user-1', 'tenant-1');

      expect(repository.marcarOrdenCompraPagada).toHaveBeenCalledWith('oc-1', expect.any(Date));
      expect(eventBus.emit).toHaveBeenCalledWith(
        EVENTOS.PAGO_ORDEN_COMPRA_REGISTRADO,
        expect.objectContaining({ tenantId: 'tenant-1', pagoId: 'pago-1', ordenCompraId: 'oc-1', monto: '1000' }),
      );
    });

    it('rechaza un pago que excede el saldo pendiente de la orden', async () => {
      repository.sumaPagosOrdenCompra.mockResolvedValue(500); // pendiente = 500, se pide 1000

      await expect(service.registrarPagoOrdenCompra(orden, dto, 'user-1', 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(repository.crear).not.toHaveBeenCalled();
    });

    it('acepta retención de ISR/ITBIS y la pasa al repositorio y al evento', async () => {
      repository.sumaPagosOrdenCompra.mockResolvedValue(0);
      repository.crear.mockResolvedValue({ id: 'pago-1' } as never);
      const dtoConRetencion = { monto: 1000, formaPagoId: 'fp1', retencionIsr: 150, retencionItbis: 300 } as never;

      await service.registrarPagoOrdenCompra(orden, dtoConRetencion, 'user-1', 'tenant-1');

      expect(repository.crear).toHaveBeenCalledWith(expect.objectContaining({ retencionIsr: 150, retencionItbis: 300 }));
      expect(eventBus.emit).toHaveBeenCalledWith(
        EVENTOS.PAGO_ORDEN_COMPRA_REGISTRADO,
        expect.objectContaining({ retencionIsr: '150', retencionItbis: '300' }),
      );
    });

    it('rechaza una retención que supera el monto del pago', async () => {
      repository.sumaPagosOrdenCompra.mockResolvedValue(0);
      const dtoConRetencionExcesiva = { monto: 1000, formaPagoId: 'fp1', retencionIsr: 600, retencionItbis: 500 } as never;

      await expect(service.registrarPagoOrdenCompra(orden, dtoConRetencionExcesiva, 'user-1', 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(repository.crear).not.toHaveBeenCalled();
    });

    it('rechaza un pago fechado en un período contable ya cerrado', async () => {
      repository.sumaPagosOrdenCompra.mockResolvedValue(0);
      cierrePeriodoService.validarFechaAbierta.mockRejectedValue(new BadRequestException('cerrado'));
      const dtoConFecha = { monto: 1000, formaPagoId: 'fp1', fecha: '2026-01-01' } as never;

      await expect(service.registrarPagoOrdenCompra(orden, dtoConFecha, 'user-1', 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(repository.crear).not.toHaveBeenCalled();
    });
  });

  describe('sumaPagosPorFacturas (mejora "Emitir nota")', () => {
    it('arma un Map facturaId -> monto a partir de las filas del groupBy', async () => {
      repository.sumaPagosPorFacturas.mockResolvedValue([
        { facturaId: 'f1', _sum: { monto: 300 } },
        { facturaId: 'f2', _sum: { monto: 0 } },
      ] as never);

      const resultado = await service.sumaPagosPorFacturas(['f1', 'f2']);

      expect(resultado.get('f1')).toBe(300);
      expect(resultado.get('f2')).toBe(0);
      expect(repository.sumaPagosPorFacturas).toHaveBeenCalledWith(['f1', 'f2']);
    });

    it('sin facturas, devuelve un Map vacío', async () => {
      const resultado = await service.sumaPagosPorFacturas([]);
      expect(resultado.size).toBe(0);
    });
  });
});
