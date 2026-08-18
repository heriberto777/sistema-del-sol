import { BadRequestException } from '@nestjs/common';
import { PagosPlataformaService } from './pagos-plataforma.service';
import { PagosPlataformaRepository } from './pagos-plataforma.repository';
import { FacturasPlataformaRepository } from './facturas-plataforma.repository';
import { FacturasPlataformaService } from './facturas-plataforma.service';

describe('PagosPlataformaService', () => {
  let service: PagosPlataformaService;
  let pagosRepo: jest.Mocked<PagosPlataformaRepository>;
  let facturasRepo: jest.Mocked<FacturasPlataformaRepository>;
  let facturasService: jest.Mocked<FacturasPlataformaService>;

  beforeEach(() => {
    pagosRepo = {
      crear: jest.fn().mockResolvedValue({ id: 'p1' }),
      sumaPagosFactura: jest.fn(),
      listarPorFactura: jest.fn(),
    } as unknown as jest.Mocked<PagosPlataformaRepository>;
    facturasRepo = { buscarPorId: jest.fn() } as unknown as jest.Mocked<FacturasPlataformaRepository>;
    facturasService = { marcarPagada: jest.fn() } as unknown as jest.Mocked<FacturasPlataformaService>;
    service = new PagosPlataformaService(pagosRepo, facturasRepo, facturasService);
  });

  it('rechaza registrar un pago sobre una factura PAGADA', async () => {
    facturasRepo.buscarPorId.mockResolvedValue({ id: 'f1', estado: 'PAGADA', total: 1000 } as never);
    await expect(service.registrar('f1', { monto: 100, metodoPago: 'EFECTIVO' } as never, 'a1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rechaza registrar un pago sobre una factura ANULADA', async () => {
    facturasRepo.buscarPorId.mockResolvedValue({ id: 'f1', estado: 'ANULADA', total: 1000 } as never);
    await expect(service.registrar('f1', { monto: 100, metodoPago: 'EFECTIVO' } as never, 'a1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rechaza un monto que excede el saldo pendiente', async () => {
    facturasRepo.buscarPorId.mockResolvedValue({ id: 'f1', estado: 'PENDIENTE', total: 1000 } as never);
    pagosRepo.sumaPagosFactura.mockResolvedValue(0);
    await expect(service.registrar('f1', { monto: 1500, metodoPago: 'EFECTIVO' } as never, 'a1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('un pago parcial no marca la factura como pagada', async () => {
    facturasRepo.buscarPorId.mockResolvedValue({ id: 'f1', estado: 'PENDIENTE', total: 1000 } as never);
    pagosRepo.sumaPagosFactura.mockResolvedValue(0);

    await service.registrar('f1', { monto: 400, metodoPago: 'TRANSFERENCIA' } as never, 'a1');

    expect(facturasService.marcarPagada).not.toHaveBeenCalled();
  });

  it('un pago que cubre el resto del saldo marca la factura como pagada', async () => {
    facturasRepo.buscarPorId.mockResolvedValue({ id: 'f1', estado: 'PENDIENTE', total: 1000 } as never);
    pagosRepo.sumaPagosFactura.mockResolvedValue(400);

    await service.registrar('f1', { monto: 600, metodoPago: 'TRANSFERENCIA' } as never, 'a1');

    expect(facturasService.marcarPagada).toHaveBeenCalledWith('f1', expect.any(Date));
  });

  it('tolera diferencias de redondeo por debajo de EPSILON al marcar pagada', async () => {
    facturasRepo.buscarPorId.mockResolvedValue({ id: 'f1', estado: 'PENDIENTE', total: 1000 } as never);
    pagosRepo.sumaPagosFactura.mockResolvedValue(400);

    await service.registrar('f1', { monto: 600.004, metodoPago: 'TRANSFERENCIA' } as never, 'a1');

    expect(facturasService.marcarPagada).toHaveBeenCalled();
  });

  describe('registrarPagoGateway', () => {
    it('es no-op si la factura ya está PAGADA (idempotente ante reintentos del webhook)', async () => {
      facturasRepo.buscarPorId.mockResolvedValue({ id: 'f1', tenantId: 't1', estado: 'PAGADA', total: 1000 } as never);

      const resultado = await service.registrarPagoGateway('f1', { monto: 1000, referenciaExterna: 'cs_1' });

      expect(resultado).toBeNull();
      expect(pagosRepo.crear).not.toHaveBeenCalled();
    });

    it('es no-op si la factura ya está ANULADA', async () => {
      facturasRepo.buscarPorId.mockResolvedValue({ id: 'f1', tenantId: 't1', estado: 'ANULADA', total: 1000 } as never);

      const resultado = await service.registrarPagoGateway('f1', { monto: 1000, referenciaExterna: 'cs_1' });

      expect(resultado).toBeNull();
      expect(pagosRepo.crear).not.toHaveBeenCalled();
    });

    it('registra el pago con metodoPago TARJETA y registradoPorId null', async () => {
      facturasRepo.buscarPorId.mockResolvedValue({ id: 'f1', tenantId: 't1', estado: 'PENDIENTE', total: 1000 } as never);
      pagosRepo.sumaPagosFactura.mockResolvedValue(1000);

      await service.registrarPagoGateway('f1', { monto: 1000, referenciaExterna: 'cs_1' });

      expect(pagosRepo.crear).toHaveBeenCalledWith(
        expect.objectContaining({ facturaId: 'f1', monto: 1000, metodoPago: 'TARJETA', referencia: 'cs_1', registradoPorId: null }),
      );
      expect(facturasService.marcarPagada).toHaveBeenCalledWith('f1', expect.any(Date));
    });

    it('no marca PAGADA si el monto pagado no cubre el total (pago parcial vía pasarela)', async () => {
      facturasRepo.buscarPorId.mockResolvedValue({ id: 'f1', tenantId: 't1', estado: 'PENDIENTE', total: 1000 } as never);
      pagosRepo.sumaPagosFactura.mockResolvedValue(400);

      await service.registrarPagoGateway('f1', { monto: 400, referenciaExterna: 'cs_1' });

      expect(facturasService.marcarPagada).not.toHaveBeenCalled();
    });
  });
});
