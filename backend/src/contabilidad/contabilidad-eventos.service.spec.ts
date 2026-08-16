import { ContabilidadEventosService } from './contabilidad-eventos.service';
import { AsientosContablesService } from './asientos-contables.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ContabilidadEventosService', () => {
  let service: ContabilidadEventosService;
  let asientosContablesService: jest.Mocked<AsientosContablesService>;
  let prisma: { recepcionCompra: { findUniqueOrThrow: jest.Mock } };

  beforeEach(() => {
    asientosContablesService = {
      generarDesdeFactura: jest.fn(),
      generarReversaFactura: jest.fn(),
      generarDesdeCompra: jest.fn(),
      generarDesdeNomina: jest.fn(),
      generarDesdePagoFactura: jest.fn(),
      generarDesdePagoOrdenCompra: jest.fn(),
      generarReversaCompra: jest.fn(),
    } as unknown as jest.Mocked<AsientosContablesService>;
    prisma = { recepcionCompra: { findUniqueOrThrow: jest.fn() } };
    service = new ContabilidadEventosService(asientosContablesService, prisma as unknown as PrismaService);
  });

  describe('alFacturarse', () => {
    it('genera el asiento con los montos convertidos a número', async () => {
      await service.alFacturarse({ tenantId: 't1', facturaId: 'f1', clienteId: 'c1', total: '354', subtotal: '300', itbis: '54', tipoFactura: 'CONTADO' });

      expect(asientosContablesService.generarDesdeFactura).toHaveBeenCalledWith({
        tenantId: 't1',
        facturaId: 'f1',
        tipoFactura: 'CONTADO',
        subtotal: 300,
        itbis: 54,
        total: 354,
      });
    });

    it('no propaga el error si falla generar el asiento (la venta ya ocurrió)', async () => {
      asientosContablesService.generarDesdeFactura.mockRejectedValue(new Error('cuenta no encontrada'));

      await expect(
        service.alFacturarse({ tenantId: 't1', facturaId: 'f1', clienteId: 'c1', total: '354', subtotal: '300', itbis: '54', tipoFactura: 'CONTADO' }),
      ).resolves.not.toThrow();
    });
  });

  describe('alAnularFactura', () => {
    it('genera la reversa contable', async () => {
      await service.alAnularFactura({ tenantId: 't1', facturaId: 'f1', clienteId: 'c1', total: '354', subtotal: '300', itbis: '54', tipoFactura: 'CONTADO' });

      expect(asientosContablesService.generarReversaFactura).toHaveBeenCalledWith({
        tenantId: 't1',
        facturaId: 'f1',
        tipoFactura: 'CONTADO',
        subtotal: 300,
        itbis: 54,
        total: 354,
      });
    });
  });

  describe('alRecibirCompra', () => {
    it('calcula monto e itbis desde las líneas de la recepción y genera el asiento', async () => {
      prisma.recepcionCompra.findUniqueOrThrow.mockResolvedValue({
        id: 'r1',
        lineas: [{ costoUnitario: 100, cantidadRecibida: 2, producto: { porcentajeItbis: 18 } }],
      });

      await service.alRecibirCompra({ tenantId: 't1', ordenCompraId: 'oc1', recepcionId: 'r1', proveedorId: 'p1', total: '236' });

      expect(asientosContablesService.generarDesdeCompra).toHaveBeenCalledWith({
        tenantId: 't1',
        recepcionId: 'r1',
        monto: 200,
        itbis: 36,
      });
    });

    it('no propaga el error si falla generar el asiento', async () => {
      prisma.recepcionCompra.findUniqueOrThrow.mockRejectedValue(new Error('no encontrada'));

      await expect(
        service.alRecibirCompra({ tenantId: 't1', ordenCompraId: 'oc1', recepcionId: 'r1', proveedorId: 'p1', total: '236' }),
      ).resolves.not.toThrow();
    });
  });

  describe('alDevolverCompra', () => {
    it('genera la reversa contable con los montos convertidos a número', async () => {
      await service.alDevolverCompra({ tenantId: 't1', ordenCompraId: 'oc1', devolucionId: 'dev-1', proveedorId: 'p1', monto: '80', itbis: '14.4' });

      expect(asientosContablesService.generarReversaCompra).toHaveBeenCalledWith({ tenantId: 't1', devolucionId: 'dev-1', monto: 80, itbis: 14.4 });
    });

    it('no propaga el error si falla generar la reversa (la devolución ya se registró)', async () => {
      asientosContablesService.generarReversaCompra.mockRejectedValue(new Error('cuenta no encontrada'));

      await expect(
        service.alDevolverCompra({ tenantId: 't1', ordenCompraId: 'oc1', devolucionId: 'dev-1', proveedorId: 'p1', monto: '80', itbis: '14.4' }),
      ).resolves.not.toThrow();
    });
  });

  describe('alRegistrarPagoFactura', () => {
    it('genera el asiento con el monto convertido a número', async () => {
      await service.alRegistrarPagoFactura({ tenantId: 't1', pagoId: 'pago-1', facturaId: 'f1', monto: '200' });

      expect(asientosContablesService.generarDesdePagoFactura).toHaveBeenCalledWith({ tenantId: 't1', pagoId: 'pago-1', monto: 200 });
    });

    it('no propaga el error si falla generar el asiento (el pago ya se registró)', async () => {
      asientosContablesService.generarDesdePagoFactura.mockRejectedValue(new Error('cuenta no encontrada'));

      await expect(
        service.alRegistrarPagoFactura({ tenantId: 't1', pagoId: 'pago-1', facturaId: 'f1', monto: '200' }),
      ).resolves.not.toThrow();
    });
  });

  describe('alRegistrarPagoOrdenCompra', () => {
    it('genera el asiento con el monto convertido a número', async () => {
      await service.alRegistrarPagoOrdenCompra({ tenantId: 't1', pagoId: 'pago-1', ordenCompraId: 'oc1', monto: '500' });

      expect(asientosContablesService.generarDesdePagoOrdenCompra).toHaveBeenCalledWith({ tenantId: 't1', pagoId: 'pago-1', monto: 500 });
    });

    it('no propaga el error si falla generar el asiento', async () => {
      asientosContablesService.generarDesdePagoOrdenCompra.mockRejectedValue(new Error('cuenta no encontrada'));

      await expect(
        service.alRegistrarPagoOrdenCompra({ tenantId: 't1', pagoId: 'pago-1', ordenCompraId: 'oc1', monto: '500' }),
      ).resolves.not.toThrow();
    });
  });

  describe('alPagarNomina', () => {
    const payload = {
      tenantId: 't1',
      periodoId: 'p1',
      totalSalarioBruto: '35000',
      totalSfsEmpleado: '1064',
      totalAfpEmpleado: '1004.5',
      totalIsr: '0',
      totalOtrasDeducciones: '0',
      totalSalarioNeto: '32931.5',
      totalSfsEmpleador: '2481.5',
      totalAfpEmpleador: '2485',
      totalInfotep: '350',
    };

    it('genera el asiento con los montos convertidos a número', async () => {
      await service.alPagarNomina(payload);

      expect(asientosContablesService.generarDesdeNomina).toHaveBeenCalledWith({
        tenantId: 't1',
        periodoId: 'p1',
        totalSalarioBruto: 35000,
        totalSfsEmpleado: 1064,
        totalAfpEmpleado: 1004.5,
        totalIsr: 0,
        totalOtrasDeducciones: 0,
        totalSalarioNeto: 32931.5,
        totalSfsEmpleador: 2481.5,
        totalAfpEmpleador: 2485,
        totalInfotep: 350,
      });
    });

    it('no propaga el error si falla generar el asiento', async () => {
      asientosContablesService.generarDesdeNomina.mockRejectedValue(new Error('cuenta no encontrada'));

      await expect(service.alPagarNomina(payload)).resolves.not.toThrow();
    });
  });
});
