import { BadRequestException } from '@nestjs/common';
import { PagosService } from './pagos.service';
import { PagosRepository } from './pagos.repository';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { CierrePeriodoService } from '../contabilidad/cierre-periodo.service';
import { FormasPagoRepository } from '../formas-pago/formas-pago.repository';
import { CuentasPorPagarRepository } from '../cuentas-por-pagar/cuentas-por-pagar.repository';

describe('PagosService', () => {
  let service: PagosService;
  let repository: jest.Mocked<PagosRepository>;
  let eventBus: jest.Mocked<EventBusService>;
  let cierrePeriodoService: jest.Mocked<CierrePeriodoService>;
  let formasPagoRepository: jest.Mocked<FormasPagoRepository>;
  let cuentasPorPagarRepository: jest.Mocked<CuentasPorPagarRepository>;

  beforeEach(() => {
    repository = {
      registrarCobroFactura: jest.fn(),
      registrarCobroOrdenCompra: jest.fn(),
      pendienteFactura: jest.fn().mockResolvedValue(null),
      sumaCobrosFactura: jest.fn().mockResolvedValue(0),
      sumaCobrosPorFacturas: jest.fn().mockResolvedValue([]),
      listarPorFactura: jest.fn(),
      listarPorOrdenCompra: jest.fn(),
      registrarCobroFacturaProveedor: jest.fn(),
      pendienteFacturaProveedor: jest.fn().mockResolvedValue(1000),
      listarPorFacturaProveedor: jest.fn(),
    } as unknown as jest.Mocked<PagosRepository>;
    eventBus = { emit: jest.fn(), on: jest.fn() } as unknown as jest.Mocked<EventBusService>;
    cierrePeriodoService = { validarFechaAbierta: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<CierrePeriodoService>;
    formasPagoRepository = { buscarPorId: jest.fn().mockResolvedValue({ id: 'fp1' }) } as unknown as jest.Mocked<FormasPagoRepository>;
    cuentasPorPagarRepository = { pendienteDeOrden: jest.fn().mockResolvedValue(1000) } as unknown as jest.Mocked<CuentasPorPagarRepository>;
    service = new PagosService(repository, eventBus, cierrePeriodoService, formasPagoRepository, cuentasPorPagarRepository);
  });

  describe('registrarPagoFactura (CxC como ledger real — Fase 3)', () => {
    const factura = { id: 'f1', total: 500, clienteId: 'cliente-1', fecha: new Date('2026-01-01'), plazoPagoDias: 30 };
    const dto = { monto: 200, formaPagoId: 'fp1' } as never;

    it('crea el ReciboIngreso vía el repositorio cuando queda saldo pendiente', async () => {
      repository.pendienteFactura.mockResolvedValue(500);
      repository.registrarCobroFactura.mockResolvedValue({ id: 'recibo-1' } as never);

      await service.registrarPagoFactura(factura, dto, 'user-1', 'tenant-1');

      expect(repository.registrarCobroFactura).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-1', facturaId: 'f1', clienteId: 'cliente-1', monto: 200, formaPagoId: 'fp1', userId: 'user-1' }),
      );
    });

    it('usa factura.total como pendiente si la factura nunca tuvo una CuentaPorCobrar (caso degenerado, el repositorio la crea sola)', async () => {
      repository.pendienteFactura.mockResolvedValue(null);
      repository.registrarCobroFactura.mockResolvedValue({ id: 'recibo-1' } as never);

      await service.registrarPagoFactura(factura, dto, 'user-1', 'tenant-1');

      expect(repository.registrarCobroFactura).toHaveBeenCalledWith(
        expect.objectContaining({ facturaFecha: factura.fecha, facturaPlazoPagoDias: 30, facturaTotal: 500 }),
      );
    });

    it('rechaza un pago que excede el saldo pendiente', async () => {
      repository.pendienteFactura.mockResolvedValue(50);

      await expect(service.registrarPagoFactura(factura, dto, 'user-1', 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(repository.registrarCobroFactura).not.toHaveBeenCalled();
    });

    it('emite PAGO_FACTURA_REGISTRADO con el id del ReciboIngreso y el monto pagado', async () => {
      repository.pendienteFactura.mockResolvedValue(500);
      repository.registrarCobroFactura.mockResolvedValue({ id: 'recibo-1' } as never);

      await service.registrarPagoFactura(factura, dto, 'user-1', 'tenant-1');

      expect(eventBus.emit).toHaveBeenCalledWith(
        EVENTOS.PAGO_FACTURA_REGISTRADO,
        expect.objectContaining({ tenantId: 'tenant-1', pagoId: 'recibo-1', facturaId: 'f1', monto: '200' }),
      );
    });

    it('valida que formaPagoId pertenezca al tenant antes de registrar el cobro', async () => {
      repository.pendienteFactura.mockResolvedValue(500);
      repository.registrarCobroFactura.mockResolvedValue({ id: 'recibo-1' } as never);

      await service.registrarPagoFactura(factura, dto, 'user-1', 'tenant-1');

      expect(formasPagoRepository.buscarPorId).toHaveBeenCalledWith('fp1');
    });

    it('rechaza un pago fechado en un período contable ya cerrado', async () => {
      repository.pendienteFactura.mockResolvedValue(500);
      cierrePeriodoService.validarFechaAbierta.mockRejectedValue(new BadRequestException('cerrado'));

      await expect(service.registrarPagoFactura(factura, dto, 'user-1', 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(repository.registrarCobroFactura).not.toHaveBeenCalled();
    });
  });

  describe('registrarPagoOrdenCompra (CxP como ledger real — Fase 3)', () => {
    const orden = { id: 'oc-1', total: 1000, proveedorId: 'prov-1', fecha: new Date('2026-01-01'), proveedor: { plazoPagoDias: 30 } };
    const dto = { monto: 1000, formaPagoId: 'fp1' } as never;

    it('crea el OrdenPago vía el repositorio cuando el monto no excede el saldo pendiente', async () => {
      cuentasPorPagarRepository.pendienteDeOrden.mockResolvedValue(1000);
      repository.registrarCobroOrdenCompra.mockResolvedValue({ id: 'orden-pago-1' } as never);

      await service.registrarPagoOrdenCompra(orden, dto, 'user-1', 'tenant-1');

      expect(repository.registrarCobroOrdenCompra).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-1', ordenCompraId: 'oc-1', proveedorId: 'prov-1', monto: 1000, formaPagoId: 'fp1' }),
      );
      expect(eventBus.emit).toHaveBeenCalledWith(
        EVENTOS.PAGO_ORDEN_COMPRA_REGISTRADO,
        expect.objectContaining({ tenantId: 'tenant-1', pagoId: 'orden-pago-1', ordenCompraId: 'oc-1', monto: '1000' }),
      );
    });

    it('rechaza un pago que excede el saldo pendiente de la orden', async () => {
      cuentasPorPagarRepository.pendienteDeOrden.mockResolvedValue(500); // pendiente = 500, se pide 1000

      await expect(service.registrarPagoOrdenCompra(orden, dto, 'user-1', 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(repository.registrarCobroOrdenCompra).not.toHaveBeenCalled();
    });

    it('acepta retención de ISR/ITBIS y la pasa al repositorio y al evento', async () => {
      cuentasPorPagarRepository.pendienteDeOrden.mockResolvedValue(1000);
      repository.registrarCobroOrdenCompra.mockResolvedValue({ id: 'orden-pago-1' } as never);
      const dtoConRetencion = { monto: 1000, formaPagoId: 'fp1', retencionIsr: 150, retencionItbis: 300 } as never;

      await service.registrarPagoOrdenCompra(orden, dtoConRetencion, 'user-1', 'tenant-1');

      expect(repository.registrarCobroOrdenCompra).toHaveBeenCalledWith(expect.objectContaining({ retencionIsr: 150, retencionItbis: 300 }));
      expect(eventBus.emit).toHaveBeenCalledWith(
        EVENTOS.PAGO_ORDEN_COMPRA_REGISTRADO,
        expect.objectContaining({ retencionIsr: '150', retencionItbis: '300' }),
      );
    });

    it('rechaza una retención que supera el monto del pago', async () => {
      cuentasPorPagarRepository.pendienteDeOrden.mockResolvedValue(1000);
      const dtoConRetencionExcesiva = { monto: 1000, formaPagoId: 'fp1', retencionIsr: 600, retencionItbis: 500 } as never;

      await expect(service.registrarPagoOrdenCompra(orden, dtoConRetencionExcesiva, 'user-1', 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(repository.registrarCobroOrdenCompra).not.toHaveBeenCalled();
    });

    it('rechaza un pago fechado en un período contable ya cerrado', async () => {
      cuentasPorPagarRepository.pendienteDeOrden.mockResolvedValue(1000);
      cierrePeriodoService.validarFechaAbierta.mockRejectedValue(new BadRequestException('cerrado'));
      const dtoConFecha = { monto: 1000, formaPagoId: 'fp1', fecha: '2026-01-01' } as never;

      await expect(service.registrarPagoOrdenCompra(orden, dtoConFecha, 'user-1', 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(repository.registrarCobroOrdenCompra).not.toHaveBeenCalled();
    });
  });

  describe('registrarPagoFacturaProveedor (Fase 5, CxP sin orden de compra)', () => {
    const facturaProveedor = { id: 'fp-1', proveedorId: 'prov-1' };
    const dto = { monto: 200, formaPagoId: 'fp1' } as never;

    it('crea el OrdenPago vía el repositorio cuando el monto no excede el saldo pendiente', async () => {
      repository.pendienteFacturaProveedor.mockResolvedValue(236);
      repository.registrarCobroFacturaProveedor.mockResolvedValue({ id: 'orden-pago-1' } as never);

      await service.registrarPagoFacturaProveedor(facturaProveedor, dto, 'user-1', 'tenant-1');

      expect(repository.registrarCobroFacturaProveedor).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-1', facturaProveedorId: 'fp-1', proveedorId: 'prov-1', monto: 200, formaPagoId: 'fp1' }),
      );
      expect(eventBus.emit).toHaveBeenCalledWith(
        EVENTOS.PAGO_FACTURA_PROVEEDOR_REGISTRADO,
        expect.objectContaining({ tenantId: 'tenant-1', pagoId: 'orden-pago-1', facturaProveedorId: 'fp-1', monto: '200' }),
      );
    });

    it('rechaza un pago que excede el saldo pendiente (sin FIFO, lee el saldo directo)', async () => {
      repository.pendienteFacturaProveedor.mockResolvedValue(100); // pendiente = 100, se pide 200

      await expect(service.registrarPagoFacturaProveedor(facturaProveedor, dto, 'user-1', 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(repository.registrarCobroFacturaProveedor).not.toHaveBeenCalled();
    });

    it('acepta retención de ISR/ITBIS y la pasa al repositorio y al evento', async () => {
      repository.pendienteFacturaProveedor.mockResolvedValue(236);
      repository.registrarCobroFacturaProveedor.mockResolvedValue({ id: 'orden-pago-1' } as never);
      const dtoConRetencion = { monto: 236, formaPagoId: 'fp1', retencionIsr: 20, retencionItbis: 30 } as never;

      await service.registrarPagoFacturaProveedor(facturaProveedor, dtoConRetencion, 'user-1', 'tenant-1');

      expect(repository.registrarCobroFacturaProveedor).toHaveBeenCalledWith(expect.objectContaining({ retencionIsr: 20, retencionItbis: 30 }));
    });

    it('rechaza una retención que supera el monto del pago', async () => {
      repository.pendienteFacturaProveedor.mockResolvedValue(1000);
      const dtoConRetencionExcesiva = { monto: 200, formaPagoId: 'fp1', retencionIsr: 150, retencionItbis: 100 } as never;

      await expect(
        service.registrarPagoFacturaProveedor(facturaProveedor, dtoConRetencionExcesiva, 'user-1', 'tenant-1'),
      ).rejects.toThrow(BadRequestException);
      expect(repository.registrarCobroFacturaProveedor).not.toHaveBeenCalled();
    });

    it('rechaza un pago fechado en un período contable ya cerrado', async () => {
      repository.pendienteFacturaProveedor.mockResolvedValue(1000);
      cierrePeriodoService.validarFechaAbierta.mockRejectedValue(new BadRequestException('cerrado'));

      await expect(service.registrarPagoFacturaProveedor(facturaProveedor, dto, 'user-1', 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(repository.registrarCobroFacturaProveedor).not.toHaveBeenCalled();
    });
  });

  describe('sumaPagosFactura / sumaPagosPorFacturas (passthrough al repositorio)', () => {
    it('sumaPagosFactura delega en sumaCobrosFactura', async () => {
      repository.sumaCobrosFactura.mockResolvedValue(300);

      const resultado = await service.sumaPagosFactura('f1');

      expect(resultado).toBe(300);
      expect(repository.sumaCobrosFactura).toHaveBeenCalledWith('f1');
    });

    it('sumaPagosPorFacturas arma un Map facturaId -> monto a partir de las filas del groupBy', async () => {
      repository.sumaCobrosPorFacturas.mockResolvedValue([
        { facturaId: 'f1', _sum: { monto: 300 } },
        { facturaId: 'f2', _sum: { monto: 0 } },
      ] as never);

      const resultado = await service.sumaPagosPorFacturas(['f1', 'f2']);

      expect(resultado.get('f1')).toBe(300);
      expect(resultado.get('f2')).toBe(0);
      expect(repository.sumaCobrosPorFacturas).toHaveBeenCalledWith(['f1', 'f2']);
    });
  });
});
