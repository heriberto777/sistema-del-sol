import { ContabilidadEventosService } from './contabilidad-eventos.service';
import { AsientosContablesService } from './asientos-contables.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ContabilidadEventosService', () => {
  let service: ContabilidadEventosService;
  let asientosContablesService: jest.Mocked<AsientosContablesService>;
  let prisma: {
    recepcionCompra: { findUniqueOrThrow: jest.Mock };
    gastoMenor: { findUniqueOrThrow: jest.Mock };
    factura: { findUniqueOrThrow: jest.Mock };
    reciboIngreso: { findUniqueOrThrow: jest.Mock };
    ordenPago: { findUniqueOrThrow: jest.Mock };
  };

  beforeEach(() => {
    asientosContablesService = {
      generarDesdeFactura: jest.fn(),
      generarReversaFactura: jest.fn(),
      generarDesdeCompra: jest.fn(),
      generarDesdeGastoMenor: jest.fn(),
      generarDesdeNomina: jest.fn(),
      generarDesdePagoFactura: jest.fn(),
      generarDesdePagoOrdenCompra: jest.fn(),
      generarReversaCompra: jest.fn(),
    } as unknown as jest.Mocked<AsientosContablesService>;
    prisma = {
      recepcionCompra: { findUniqueOrThrow: jest.fn() },
      gastoMenor: { findUniqueOrThrow: jest.fn() },
      // Motor de costeo + parametrización por categoría — default sin
      // líneas (ingresosPorCuenta/costosPorCuenta vacíos); los tests que
      // sí verifican esto lo sobreescriben puntual.
      factura: { findUniqueOrThrow: jest.fn().mockResolvedValue({ lineas: [] }) },
      // Default sin cuenta bancaria elegida (cae en la cuenta genérica) —
      // los tests que sí verifican la cuenta real lo sobreescriben puntual.
      reciboIngreso: { findUniqueOrThrow: jest.fn().mockResolvedValue({ cuentaBancaria: null }) },
      ordenPago: { findUniqueOrThrow: jest.fn().mockResolvedValue({ cuentaBancaria: null }) },
    };
    service = new ContabilidadEventosService(asientosContablesService, prisma as unknown as PrismaService);
  });

  describe('alFacturarse', () => {
    it('genera el asiento con los montos convertidos a número, agrupando las líneas (sin categoría -> cuentaContableId null)', async () => {
      prisma.factura.findUniqueOrThrow.mockResolvedValue({
        lineas: [{ cantidad: 1, costoUnitario: null, montoTotal: 354, montoItbis: 54, producto: null }],
      });

      await service.alFacturarse({ tenantId: 't1', facturaId: 'f1', clienteId: 'c1', total: '354', subtotal: '300', itbis: '54', tipoFactura: 'CONTADO' });

      expect(asientosContablesService.generarDesdeFactura).toHaveBeenCalledWith({
        tenantId: 't1',
        facturaId: 'f1',
        tipoFactura: 'CONTADO',
        itbis: 54,
        total: 354,
        recargos: 0,
        ingresosPorCuenta: [{ cuentaContableId: null, monto: 300 }],
        costosPorCuenta: [],
      });
    });

    it('ítem B-4: propaga los recargos convertidos a número (sin esto, el asiento queda desbalanceado)', async () => {
      await service.alFacturarse({
        tenantId: 't1',
        facturaId: 'f1',
        clienteId: 'c1',
        total: '412.65',
        subtotal: '299.70',
        itbis: '62.95',
        tipoFactura: 'CONTADO',
        recargos: '50',
      });

      expect(asientosContablesService.generarDesdeFactura).toHaveBeenCalledWith(expect.objectContaining({ recargos: 50 }));
    });

    it('no propaga el error si falla generar el asiento (la venta ya ocurrió)', async () => {
      asientosContablesService.generarDesdeFactura.mockRejectedValue(new Error('cuenta no encontrada'));

      await expect(
        service.alFacturarse({ tenantId: 't1', facturaId: 'f1', clienteId: 'c1', total: '354', subtotal: '300', itbis: '54', tipoFactura: 'CONTADO' }),
      ).resolves.not.toThrow();
    });

    describe('parametrización de cuentas por categoría (docs/PLAN.md, punto 2)', () => {
      it('una línea cuyo producto tiene categoría con cuenta de ingreso/costo propia las propaga en vez de null', async () => {
        prisma.factura.findUniqueOrThrow.mockResolvedValue({
          lineas: [
            {
              cantidad: 2,
              costoUnitario: 80,
              montoTotal: 236,
              montoItbis: 36,
              producto: { categoria: { cuentaIngresoId: 'cuenta-ingreso-servicios', cuentaCostoId: 'cuenta-costo-servicios' } },
            },
          ],
        });

        await service.alFacturarse({ tenantId: 't1', facturaId: 'f1', clienteId: 'c1', total: '236', subtotal: '200', itbis: '36', tipoFactura: 'CONTADO' });

        expect(asientosContablesService.generarDesdeFactura).toHaveBeenCalledWith(
          expect.objectContaining({
            ingresosPorCuenta: [{ cuentaContableId: 'cuenta-ingreso-servicios', monto: 200 }],
            costosPorCuenta: [{ cuentaContableId: 'cuenta-costo-servicios', monto: 160 }],
          }),
        );
      });

      it('un producto sin categoría, o una categoría sin cuenta propia, da cuentaContableId null (cae en la genérica)', async () => {
        prisma.factura.findUniqueOrThrow.mockResolvedValue({
          lineas: [
            { cantidad: 1, costoUnitario: 50, montoTotal: 118, montoItbis: 18, producto: { categoria: null } },
            { cantidad: 1, costoUnitario: 30, montoTotal: 118, montoItbis: 18, producto: { categoria: { cuentaIngresoId: null, cuentaCostoId: null } } },
          ],
        });

        await service.alFacturarse({ tenantId: 't1', facturaId: 'f1', clienteId: 'c1', total: '236', subtotal: '200', itbis: '36', tipoFactura: 'CONTADO' });

        expect(asientosContablesService.generarDesdeFactura).toHaveBeenCalledWith(
          expect.objectContaining({
            ingresosPorCuenta: [
              { cuentaContableId: null, monto: 100 },
              { cuentaContableId: null, monto: 100 },
            ],
          }),
        );
      });
    });

    describe('motor de costeo (Costo de Ventas)', () => {
      it('suma cantidad×costoUnitario de las líneas con producto, y lo manda en costosPorCuenta', async () => {
        prisma.factura.findUniqueOrThrow.mockResolvedValue({
          lineas: [
            { cantidad: 2, costoUnitario: 100, montoTotal: 150, montoItbis: 0, producto: null },
            { cantidad: 1, costoUnitario: 50, montoTotal: 100, montoItbis: 0, producto: null },
            { cantidad: 3, costoUnitario: null, montoTotal: 50, montoItbis: 0, producto: null }, // SERVICIO/línea manual — no suma nada
          ],
        });

        await service.alFacturarse({ tenantId: 't1', facturaId: 'f1', clienteId: 'c1', total: '354', subtotal: '300', itbis: '54', tipoFactura: 'CONTADO' });

        expect(asientosContablesService.generarDesdeFactura).toHaveBeenCalledWith(
          expect.objectContaining({
            costosPorCuenta: [
              { cuentaContableId: null, monto: 200 },
              { cuentaContableId: null, monto: 50 },
            ],
          }),
        );
      });

      it('NOTA_CREDITO: el costo sale en negativo (mismo signo que subtotal/itbis/total)', async () => {
        prisma.factura.findUniqueOrThrow.mockResolvedValue({
          lineas: [{ cantidad: 2, costoUnitario: 100, montoTotal: 200, montoItbis: 0, producto: null }],
        });

        await service.alFacturarse({ tenantId: 't1', facturaId: 'f1', clienteId: 'c1', total: '-354', subtotal: '-300', itbis: '-54', tipoFactura: 'NOTA_CREDITO' });

        expect(asientosContablesService.generarDesdeFactura).toHaveBeenCalledWith(
          expect.objectContaining({ costosPorCuenta: [{ cuentaContableId: null, monto: -200 }] }),
        );
      });
    });
  });

  describe('alAnularFactura', () => {
    it('genera la reversa contable', async () => {
      prisma.factura.findUniqueOrThrow.mockResolvedValue({
        lineas: [{ cantidad: 1, costoUnitario: null, montoTotal: 354, montoItbis: 54, producto: null }],
      });

      await service.alAnularFactura({ tenantId: 't1', facturaId: 'f1', clienteId: 'c1', total: '354', subtotal: '300', itbis: '54', tipoFactura: 'CONTADO' });

      expect(asientosContablesService.generarReversaFactura).toHaveBeenCalledWith({
        tenantId: 't1',
        facturaId: 'f1',
        tipoFactura: 'CONTADO',
        itbis: 54,
        total: 354,
        recargos: 0,
        ingresosPorCuenta: [{ cuentaContableId: null, monto: 300 }],
        costosPorCuenta: [],
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
    it('genera el asiento con el monto convertido a número, sin cuenta bancaria elegida', async () => {
      await service.alRegistrarPagoFactura({ tenantId: 't1', pagoId: 'pago-1', facturaId: 'f1', monto: '200' });

      expect(asientosContablesService.generarDesdePagoFactura).toHaveBeenCalledWith({
        tenantId: 't1',
        pagoId: 'pago-1',
        monto: 200,
        cuentaCajaId: undefined,
      });
    });

    it('si el cobro eligió una cuenta bancaria real, propaga su cuenta contable', async () => {
      prisma.reciboIngreso.findUniqueOrThrow.mockResolvedValue({ cuentaBancaria: { cuentaContableId: 'cuenta-banco-1' } });

      await service.alRegistrarPagoFactura({ tenantId: 't1', pagoId: 'pago-1', facturaId: 'f1', monto: '200' });

      expect(asientosContablesService.generarDesdePagoFactura).toHaveBeenCalledWith(
        expect.objectContaining({ cuentaCajaId: 'cuenta-banco-1' }),
      );
    });

    it('no propaga el error si falla generar el asiento (el pago ya se registró)', async () => {
      asientosContablesService.generarDesdePagoFactura.mockRejectedValue(new Error('cuenta no encontrada'));

      await expect(
        service.alRegistrarPagoFactura({ tenantId: 't1', pagoId: 'pago-1', facturaId: 'f1', monto: '200' }),
      ).resolves.not.toThrow();
    });
  });

  describe('alRegistrarPagoOrdenCompra', () => {
    it('genera el asiento con el monto y la retención convertidos a número, sin cuenta bancaria elegida', async () => {
      await service.alRegistrarPagoOrdenCompra({
        tenantId: 't1',
        pagoId: 'pago-1',
        ordenCompraId: 'oc1',
        monto: '500',
        retencionIsr: '75',
        retencionItbis: '30',
      });

      expect(asientosContablesService.generarDesdePagoOrdenCompra).toHaveBeenCalledWith({
        tenantId: 't1',
        pagoId: 'pago-1',
        monto: 500,
        retencionIsr: 75,
        retencionItbis: 30,
        cuentaCajaId: undefined,
      });
    });

    it('si el pago eligió una cuenta bancaria real, propaga su cuenta contable', async () => {
      prisma.ordenPago.findUniqueOrThrow.mockResolvedValue({ cuentaBancaria: { cuentaContableId: 'cuenta-banco-2' } });

      await service.alRegistrarPagoOrdenCompra({
        tenantId: 't1',
        pagoId: 'pago-1',
        ordenCompraId: 'oc1',
        monto: '500',
        retencionIsr: '0',
        retencionItbis: '0',
      });

      expect(asientosContablesService.generarDesdePagoOrdenCompra).toHaveBeenCalledWith(
        expect.objectContaining({ cuentaCajaId: 'cuenta-banco-2' }),
      );
    });

    it('no propaga el error si falla generar el asiento', async () => {
      asientosContablesService.generarDesdePagoOrdenCompra.mockRejectedValue(new Error('cuenta no encontrada'));

      await expect(
        service.alRegistrarPagoOrdenCompra({ tenantId: 't1', pagoId: 'pago-1', ordenCompraId: 'oc1', monto: '500', retencionIsr: '0', retencionItbis: '0' }),
      ).resolves.not.toThrow();
    });
  });

  describe('alRegistrarPagoFacturaProveedor', () => {
    it('reusa generarDesdePagoOrdenCompra (mismo tratamiento contable) — bug real: este evento no tenía listener', async () => {
      await service.alRegistrarPagoFacturaProveedor({
        tenantId: 't1',
        pagoId: 'pago-1',
        facturaProveedorId: 'fp1',
        monto: '300',
        retencionIsr: '0',
        retencionItbis: '0',
      });

      expect(asientosContablesService.generarDesdePagoOrdenCompra).toHaveBeenCalledWith({
        tenantId: 't1',
        pagoId: 'pago-1',
        monto: 300,
        retencionIsr: 0,
        retencionItbis: 0,
        cuentaCajaId: undefined,
      });
    });

    it('si el pago eligió una cuenta bancaria real, propaga su cuenta contable', async () => {
      prisma.ordenPago.findUniqueOrThrow.mockResolvedValue({ cuentaBancaria: { cuentaContableId: 'cuenta-banco-3' } });

      await service.alRegistrarPagoFacturaProveedor({
        tenantId: 't1',
        pagoId: 'pago-1',
        facturaProveedorId: 'fp1',
        monto: '300',
        retencionIsr: '0',
        retencionItbis: '0',
      });

      expect(asientosContablesService.generarDesdePagoOrdenCompra).toHaveBeenCalledWith(
        expect.objectContaining({ cuentaCajaId: 'cuenta-banco-3' }),
      );
    });

    it('no propaga el error si falla generar el asiento', async () => {
      asientosContablesService.generarDesdePagoOrdenCompra.mockRejectedValue(new Error('cuenta no encontrada'));

      await expect(
        service.alRegistrarPagoFacturaProveedor({
          tenantId: 't1',
          pagoId: 'pago-1',
          facturaProveedorId: 'fp1',
          monto: '300',
          retencionIsr: '0',
          retencionItbis: '0',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('alCrearGastoMenor', () => {
    it('re-consulta el gasto menor y genera el asiento con sus líneas y la cuenta bancaria', async () => {
      prisma.gastoMenor.findUniqueOrThrow.mockResolvedValue({
        id: 'gm1',
        itbis: 27,
        cuentaBancaria: { cuentaContableId: 'cuenta-banco-1' },
        lineas: [
          { cuentaContableId: 'cuenta-gasto-1', valor: 100, cantidad: 1 },
          { cuentaContableId: 'cuenta-gasto-2', valor: 50, cantidad: 2 },
        ],
      });

      await service.alCrearGastoMenor({ tenantId: 't1', gastoMenorId: 'gm1' });

      expect(asientosContablesService.generarDesdeGastoMenor).toHaveBeenCalledWith({
        tenantId: 't1',
        gastoMenorId: 'gm1',
        cuentaBancariaCuentaContableId: 'cuenta-banco-1',
        itbis: 27,
        lineas: [
          { cuentaContableId: 'cuenta-gasto-1', monto: 100 },
          { cuentaContableId: 'cuenta-gasto-2', monto: 100 }, // 50 * 2
        ],
      });
    });

    it('no propaga el error si falla generar el asiento (el gasto ya se registró)', async () => {
      prisma.gastoMenor.findUniqueOrThrow.mockRejectedValue(new Error('no encontrado'));

      await expect(service.alCrearGastoMenor({ tenantId: 't1', gastoMenorId: 'gm1' })).resolves.not.toThrow();
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
      totalDescuentoAusencias: '0',
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
        totalDescuentoAusencias: 0,
        totalHorasExtra: 0,
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
