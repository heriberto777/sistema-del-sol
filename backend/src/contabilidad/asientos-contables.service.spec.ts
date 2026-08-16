import { BadRequestException } from '@nestjs/common';
import { AsientosContablesService } from './asientos-contables.service';
import { AsientosContablesRepository } from './asientos-contables.repository';
import { CuentasContablesRepository } from './cuentas-contables.repository';
import { CierrePeriodoRepository } from './cierre-periodo.repository';
import { CODIGOS_CUENTA } from './cuentas-base';

describe('AsientosContablesService', () => {
  let service: AsientosContablesService;
  let asientosRepository: jest.Mocked<AsientosContablesRepository>;
  let cuentasRepository: jest.Mocked<CuentasContablesRepository>;
  let cierrePeriodoRepository: jest.Mocked<CierrePeriodoRepository>;

  const cuenta = (codigo: string) => ({ id: `cuenta-${codigo}`, codigo });

  beforeEach(() => {
    asientosRepository = { crear: jest.fn(), crearGlobal: jest.fn(), buscarPorId: jest.fn(), listar: jest.fn() } as unknown as jest.Mocked<AsientosContablesRepository>;
    cuentasRepository = { buscarPorCodigo: jest.fn(), buscarPorCodigoGlobal: jest.fn(), listar: jest.fn(), crear: jest.fn() } as unknown as jest.Mocked<CuentasContablesRepository>;
    cuentasRepository.buscarPorCodigoGlobal.mockImplementation(((_tenantId: string, codigo: string) => Promise.resolve(cuenta(codigo))) as never);
    cierrePeriodoRepository = { buscarUltimo: jest.fn().mockResolvedValue(null) } as unknown as jest.Mocked<CierrePeriodoRepository>;
    service = new AsientosContablesService(asientosRepository, cuentasRepository, cierrePeriodoRepository);
  });

  describe('crear (manual)', () => {
    it('acepta un asiento donde débito total == crédito total', async () => {
      asientosRepository.crear.mockResolvedValue({ id: 'a1' } as never);

      await service.crear(
        { concepto: 'Ajuste', lineas: [{ cuentaContableId: 'c1', debito: 100 }, { cuentaContableId: 'c2', credito: 100 }] },
        'tenant-1',
      );

      expect(asientosRepository.crear).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-1', origen: 'MANUAL' }),
      );
    });

    it('rechaza un asiento que no balancea', async () => {
      await expect(
        service.crear(
          { concepto: 'Ajuste malo', lineas: [{ cuentaContableId: 'c1', debito: 100 }, { cuentaContableId: 'c2', credito: 99 }] },
          'tenant-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(asientosRepository.crear).not.toHaveBeenCalled();
    });

    it('tolera diferencias de redondeo menores a medio centavo', async () => {
      asientosRepository.crear.mockResolvedValue({ id: 'a1' } as never);

      await expect(
        service.crear(
          { concepto: 'Redondeo', lineas: [{ cuentaContableId: 'c1', debito: 100.001 }, { cuentaContableId: 'c2', credito: 100 }] },
          'tenant-1',
        ),
      ).resolves.toBeDefined();
    });

    it('rechaza un asiento fechado en o antes del último cierre de período', async () => {
      cierrePeriodoRepository.buscarUltimo.mockResolvedValue({ fecha: new Date('2026-06-30') } as never);

      await expect(
        service.crear(
          { concepto: 'Ajuste tardío', fecha: '2026-06-15', lineas: [{ cuentaContableId: 'c1', debito: 100 }, { cuentaContableId: 'c2', credito: 100 }] },
          'tenant-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(asientosRepository.crear).not.toHaveBeenCalled();
    });

    it('permite un asiento fechado después del último cierre', async () => {
      cierrePeriodoRepository.buscarUltimo.mockResolvedValue({ fecha: new Date('2026-06-30') } as never);
      asientosRepository.crear.mockResolvedValue({ id: 'a1' } as never);

      await expect(
        service.crear(
          { concepto: 'Ajuste normal', fecha: '2026-07-15', lineas: [{ cuentaContableId: 'c1', debito: 100 }, { cuentaContableId: 'c2', credito: 100 }] },
          'tenant-1',
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('generarDesdeFactura', () => {
    it('CONTADO debita Caja, acredita Ingresos e ITBIS por Pagar', async () => {
      asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);

      await service.generarDesdeFactura({ tenantId: 't1', facturaId: 'f1', tipoFactura: 'CONTADO', subtotal: 300, itbis: 54, total: 354 });

      expect(cuentasRepository.buscarPorCodigoGlobal).toHaveBeenCalledWith('t1', CODIGOS_CUENTA.CAJA_BANCOS);
      const [llamada] = asientosRepository.crearGlobal.mock.calls[0];
      const lineas = llamada.lineas;
      expect(lineas).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.CAJA_BANCOS}`, debito: 354 }),
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.INGRESOS_POR_VENTAS}`, credito: 300 }),
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.ITBIS_POR_PAGAR}`, credito: 54 }),
        ]),
      );
      // balancea: 354 debito == 300+54 credito
      const totalDebito = lineas.reduce((acc: number, l: { debito: number }) => acc + l.debito, 0);
      const totalCredito = lineas.reduce((acc: number, l: { credito: number }) => acc + l.credito, 0);
      expect(totalDebito).toBeCloseTo(totalCredito, 5);
    });

    it('CREDITO usa Cuentas por Cobrar en vez de Caja', async () => {
      asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);

      await service.generarDesdeFactura({ tenantId: 't1', facturaId: 'f1', tipoFactura: 'CREDITO', subtotal: 300, itbis: 54, total: 354 });

      expect(cuentasRepository.buscarPorCodigoGlobal).toHaveBeenCalledWith('t1', CODIGOS_CUENTA.CUENTAS_POR_COBRAR);
    });

    it('NOTA_CREDITO (montos ya negativos) invierte débito/crédito y sigue balanceando', async () => {
      asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);

      await service.generarDesdeFactura({ tenantId: 't1', facturaId: 'nc1', tipoFactura: 'NOTA_CREDITO', subtotal: -300, itbis: -54, total: -354 });

      const [llamada] = asientosRepository.crearGlobal.mock.calls[0];
      const lineas = llamada.lineas;
      // la cuenta de cobro (CxC porque no es CONTADO) ahora va en crédito, no en débito
      expect(lineas).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.CUENTAS_POR_COBRAR}`, credito: 354 }),
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.INGRESOS_POR_VENTAS}`, debito: 300 }),
        ]),
      );
    });

    it('no agrega línea de ITBIS si el itbis es 0', async () => {
      asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);

      await service.generarDesdeFactura({ tenantId: 't1', facturaId: 'f1', tipoFactura: 'CONTADO', subtotal: 100, itbis: 0, total: 100 });

      const [llamada] = asientosRepository.crearGlobal.mock.calls[0];
      expect(llamada.lineas).toHaveLength(2);
    });
  });

  describe('generarReversaFactura', () => {
    it('genera el asiento contrario exacto (monta negados)', async () => {
      asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);

      await service.generarReversaFactura({ tenantId: 't1', facturaId: 'f1', tipoFactura: 'CONTADO', subtotal: 300, itbis: 54, total: 354 });

      const [llamada] = asientosRepository.crearGlobal.mock.calls[0];
      const lineas = llamada.lineas;
      // ahora Caja va en crédito (se revierte la entrada de dinero)
      expect(lineas).toEqual(
        expect.arrayContaining([expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.CAJA_BANCOS}`, credito: 354 })]),
      );
    });
  });

  describe('generarDesdeCompra', () => {
    it('debita Inventario e ITBIS Adelantado, acredita Cuentas por Pagar por el total', async () => {
      asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);

      await service.generarDesdeCompra({ tenantId: 't1', recepcionId: 'r1', monto: 200, itbis: 36 });

      const [llamada] = asientosRepository.crearGlobal.mock.calls[0];
      const lineas = llamada.lineas;
      expect(lineas).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.INVENTARIO}`, debito: 200 }),
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.ITBIS_ADELANTADO}`, debito: 36 }),
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.CUENTAS_POR_PAGAR}`, credito: 236 }),
        ]),
      );
      const totalDebito = lineas.reduce((acc: number, l: { debito: number }) => acc + l.debito, 0);
      const totalCredito = lineas.reduce((acc: number, l: { credito: number }) => acc + l.credito, 0);
      expect(totalDebito).toBeCloseTo(totalCredito, 5);
    });
  });

  describe('generarDesdeNomina', () => {
    it('debita Gastos de Nómina (bruto + aportes patronales), acredita Caja (neto) y TSS/ISR por Pagar (retenciones + aportes)', async () => {
      asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);

      await service.generarDesdeNomina({
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

      expect(cuentasRepository.buscarPorCodigoGlobal).toHaveBeenCalledWith('t1', CODIGOS_CUENTA.GASTOS_DE_NOMINA);
      const [llamada] = asientosRepository.crearGlobal.mock.calls[0];
      const lineas = llamada.lineas;
      expect(lineas).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.GASTOS_DE_NOMINA}`, debito: 40316.5 }),
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.CAJA_BANCOS}`, credito: 32931.5 }),
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.TSS_ISR_POR_PAGAR}`, credito: 7385 }),
        ]),
      );
      const totalDebito = lineas.reduce((acc: number, l: { debito: number }) => acc + l.debito, 0);
      const totalCredito = lineas.reduce((acc: number, l: { credito: number }) => acc + l.credito, 0);
      expect(totalDebito).toBeCloseTo(totalCredito, 5);
    });
  });

  describe('generarReversaCompra', () => {
    it('acredita Inventario/ITBIS Adelantado y debita Cuentas por Pagar (inverso exacto de generarDesdeCompra)', async () => {
      asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);

      await service.generarReversaCompra({ tenantId: 't1', devolucionId: 'dev-1', monto: 80, itbis: 14.4 });

      const [llamada] = asientosRepository.crearGlobal.mock.calls[0];
      expect(llamada.origen).toBe('COMPRA');
      const lineas = llamada.lineas;
      expect(lineas).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.INVENTARIO}`, credito: 80 }),
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.ITBIS_ADELANTADO}`, credito: 14.4 }),
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.CUENTAS_POR_PAGAR}`, debito: 94.4 }),
        ]),
      );
      const totalDebito = lineas.reduce((acc: number, l: { debito: number }) => acc + l.debito, 0);
      const totalCredito = lineas.reduce((acc: number, l: { credito: number }) => acc + l.credito, 0);
      expect(totalDebito).toBeCloseTo(totalCredito, 5);
    });
  });

  describe('generarDesdePagoFactura', () => {
    it('debita Caja/Bancos y acredita Cuentas por Cobrar por el monto del pago', async () => {
      asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);

      await service.generarDesdePagoFactura({ tenantId: 't1', pagoId: 'pago-1', monto: 200 });

      const [llamada] = asientosRepository.crearGlobal.mock.calls[0];
      expect(llamada.origen).toBe('PAGO');
      expect(llamada.lineas).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.CAJA_BANCOS}`, debito: 200 }),
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.CUENTAS_POR_COBRAR}`, credito: 200 }),
        ]),
      );
    });
  });

  describe('generarDesdePagoOrdenCompra', () => {
    it('debita Cuentas por Pagar y acredita Caja/Bancos por el monto del pago', async () => {
      asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);

      await service.generarDesdePagoOrdenCompra({ tenantId: 't1', pagoId: 'pago-1', monto: 500 });

      const [llamada] = asientosRepository.crearGlobal.mock.calls[0];
      expect(llamada.origen).toBe('PAGO');
      expect(llamada.lineas).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.CUENTAS_POR_PAGAR}`, debito: 500 }),
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.CAJA_BANCOS}`, credito: 500 }),
        ]),
      );
    });
  });

  describe('crearGasto', () => {
    it('genera un asiento balanceado de 2 líneas con origen GASTO', async () => {
      asientosRepository.crear.mockResolvedValue({ id: 'a1' } as never);

      await service.crearGasto(
        { concepto: 'Pago de alquiler', monto: 15000, cuentaGastoId: 'cuenta-gasto', cuentaOrigenId: 'cuenta-caja' },
        'tenant-1',
      );

      expect(asientosRepository.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          concepto: 'Pago de alquiler',
          origen: 'GASTO',
          lineas: [
            { cuentaContableId: 'cuenta-gasto', debito: 15000, credito: 0 },
            { cuentaContableId: 'cuenta-caja', debito: 0, credito: 15000 },
          ],
        }),
      );
    });
  });
});
