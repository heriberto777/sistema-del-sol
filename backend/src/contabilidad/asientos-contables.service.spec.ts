import { BadRequestException } from '@nestjs/common';
import { AsientosContablesService } from './asientos-contables.service';
import { AsientosContablesRepository } from './asientos-contables.repository';
import { CuentasContablesRepository } from './cuentas-contables.repository';
import { CierrePeriodoService } from './cierre-periodo.service';
import { CODIGOS_CUENTA } from './cuentas-base';

describe('AsientosContablesService', () => {
  let service: AsientosContablesService;
  let asientosRepository: jest.Mocked<AsientosContablesRepository>;
  let cuentasRepository: jest.Mocked<CuentasContablesRepository>;
  let cierrePeriodoService: jest.Mocked<CierrePeriodoService>;

  const cuenta = (codigo: string) => ({ id: `cuenta-${codigo}`, codigo });

  beforeEach(() => {
    asientosRepository = {
      crear: jest.fn(),
      crearGlobal: jest.fn(),
      buscarPorId: jest.fn(),
      listar: jest.fn(),
      marcarAnulado: jest.fn(),
    } as unknown as jest.Mocked<AsientosContablesRepository>;
    cuentasRepository = { buscarPorCodigo: jest.fn(), buscarPorCodigoGlobal: jest.fn(), listar: jest.fn(), crear: jest.fn() } as unknown as jest.Mocked<CuentasContablesRepository>;
    cuentasRepository.buscarPorCodigoGlobal.mockImplementation(((_tenantId: string, codigo: string) => Promise.resolve(cuenta(codigo))) as never);
    cierrePeriodoService = { validarFechaAbierta: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<CierrePeriodoService>;
    service = new AsientosContablesService(asientosRepository, cuentasRepository, cierrePeriodoService);
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
      cierrePeriodoService.validarFechaAbierta.mockRejectedValue(new BadRequestException('cerrado'));

      await expect(
        service.crear(
          { concepto: 'Ajuste tardío', fecha: '2026-06-15', lineas: [{ cuentaContableId: 'c1', debito: 100 }, { cuentaContableId: 'c2', credito: 100 }] },
          'tenant-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(asientosRepository.crear).not.toHaveBeenCalled();
    });

    it('permite un asiento fechado después del último cierre', async () => {
      asientosRepository.crear.mockResolvedValue({ id: 'a1' } as never);

      await expect(
        service.crear(
          { concepto: 'Ajuste normal', fecha: '2026-07-15', lineas: [{ cuentaContableId: 'c1', debito: 100 }, { cuentaContableId: 'c2', credito: 100 }] },
          'tenant-1',
        ),
      ).resolves.toBeDefined();
      expect(cierrePeriodoService.validarFechaAbierta).toHaveBeenCalledWith(new Date('2026-07-15'));
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

  describe('generarDesdeGastoMenor', () => {
    it('debita cada línea de gasto por su cuenta contable, debita ITBIS Adelantado, y acredita la cuenta bancaria por el total', async () => {
      asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);

      await service.generarDesdeGastoMenor({
        tenantId: 't1',
        gastoMenorId: 'gm1',
        cuentaBancariaCuentaContableId: 'cuenta-banco-1',
        itbis: 27,
        lineas: [
          { cuentaContableId: 'cuenta-gasto-combustible', monto: 100 },
          { cuentaContableId: 'cuenta-gasto-oficina', monto: 50 },
        ],
      });

      const [llamada] = asientosRepository.crearGlobal.mock.calls[0];
      expect(llamada.origen).toBe('GASTO_MENOR');
      expect(llamada.origenId).toBe('gm1');
      const lineas = llamada.lineas;
      expect(lineas).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ cuentaContableId: 'cuenta-gasto-combustible', debito: 100 }),
          expect.objectContaining({ cuentaContableId: 'cuenta-gasto-oficina', debito: 50 }),
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.ITBIS_ADELANTADO}`, debito: 27 }),
          expect.objectContaining({ cuentaContableId: 'cuenta-banco-1', credito: 177 }), // 100+50+27
        ]),
      );
      const totalDebito = lineas.reduce((acc: number, l: { debito: number }) => acc + l.debito, 0);
      const totalCredito = lineas.reduce((acc: number, l: { credito: number }) => acc + l.credito, 0);
      expect(totalDebito).toBeCloseTo(totalCredito, 5);
    });

    it('sin ITBIS, no agrega la línea de ITBIS Adelantado', async () => {
      asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);

      await service.generarDesdeGastoMenor({
        tenantId: 't1',
        gastoMenorId: 'gm2',
        cuentaBancariaCuentaContableId: 'cuenta-banco-1',
        itbis: 0,
        lineas: [{ cuentaContableId: 'cuenta-gasto-combustible', monto: 100 }],
      });

      const [llamada] = asientosRepository.crearGlobal.mock.calls[0];
      expect(llamada.lineas).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.ITBIS_ADELANTADO}` })]),
      );
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
        totalDescuentoAusencias: 0,
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

    it('con descuentoAusencias (Fase 7d): resta el descuento del débito de Gastos de Nómina, no lo suma al crédito de TSS/ISR, y el asiento sigue cuadrando', async () => {
      asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);

      await service.generarDesdeNomina({
        tenantId: 't1',
        periodoId: 'p1',
        totalSalarioBruto: 35000,
        totalSfsEmpleado: 1064,
        totalAfpEmpleado: 1004.5,
        totalIsr: 0,
        totalOtrasDeducciones: 0,
        totalDescuentoAusencias: 1200,
        totalSalarioNeto: 31731.5,
        totalSfsEmpleador: 2481.5,
        totalAfpEmpleador: 2485,
        totalInfotep: 350,
      });

      const [llamada] = asientosRepository.crearGlobal.mock.calls[0];
      const lineas = llamada.lineas;
      expect(lineas).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.GASTOS_DE_NOMINA}`, debito: 39116.5 }),
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.CAJA_BANCOS}`, credito: 31731.5 }),
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.TSS_ISR_POR_PAGAR}`, credito: 7385 }),
        ]),
      );
      const totalDebito = lineas.reduce((acc: number, l: { debito: number }) => acc + l.debito, 0);
      const totalCredito = lineas.reduce((acc: number, l: { credito: number }) => acc + l.credito, 0);
      expect(totalDebito).toBeCloseTo(totalCredito, 5);
    });

    it('con totalHorasExtra: lo suma al débito de Gastos de Nómina (ya está en el neto/crédito) y el asiento sigue cuadrando', async () => {
      asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);

      await service.generarDesdeNomina({
        tenantId: 't1',
        periodoId: 'p1',
        totalSalarioBruto: 35000,
        totalSfsEmpleado: 1064,
        totalAfpEmpleado: 1004.5,
        totalIsr: 0,
        totalOtrasDeducciones: 0,
        totalDescuentoAusencias: 0,
        totalHorasExtra: 500,
        totalSalarioNeto: 33431.5,
        totalSfsEmpleador: 2481.5,
        totalAfpEmpleador: 2485,
        totalInfotep: 350,
      });

      const [llamada] = asientosRepository.crearGlobal.mock.calls[0];
      const lineas = llamada.lineas;
      expect(lineas).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.GASTOS_DE_NOMINA}`, debito: 40816.5 }),
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.CAJA_BANCOS}`, credito: 33431.5 }),
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

    it('con retención parcial de ISR e ITBIS, reparte el crédito entre Caja y las cuentas de retención, balanceado', async () => {
      asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);

      await service.generarDesdePagoOrdenCompra({ tenantId: 't1', pagoId: 'pago-1', monto: 500, retencionIsr: 75, retencionItbis: 30 });

      const [llamada] = asientosRepository.crearGlobal.mock.calls[0];
      expect(llamada.lineas).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.CUENTAS_POR_PAGAR}`, debito: 500 }),
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.CAJA_BANCOS}`, credito: 395 }),
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.ISR_RETENIDO_TERCEROS}`, credito: 75 }),
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.ITBIS_RETENIDO_TERCEROS}`, credito: 30 }),
        ]),
      );
      const totalDebito = llamada.lineas.reduce((acc: number, l: { debito: number }) => acc + l.debito, 0);
      const totalCredito = llamada.lineas.reduce((acc: number, l: { credito: number }) => acc + l.credito, 0);
      expect(totalDebito).toBe(totalCredito);
    });

    it('con retención total (retiene el 100% del pago), no genera línea de Caja', async () => {
      asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);

      await service.generarDesdePagoOrdenCompra({ tenantId: 't1', pagoId: 'pago-1', monto: 100, retencionIsr: 70, retencionItbis: 30 });

      const [llamada] = asientosRepository.crearGlobal.mock.calls[0];
      expect(llamada.lineas).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.CAJA_BANCOS}` })]),
      );
      expect(llamada.lineas).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.CUENTAS_POR_PAGAR}`, debito: 100 }),
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.ISR_RETENIDO_TERCEROS}`, credito: 70 }),
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.ITBIS_RETENIDO_TERCEROS}`, credito: 30 }),
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

  describe('anular', () => {
    const asientoManual = {
      id: 'a1',
      numero: 5,
      concepto: 'Ajuste',
      origen: 'MANUAL',
      anulado: false,
      fecha: new Date('2026-07-15'),
      lineas: [
        { cuentaContableId: 'c1', debito: 100, credito: 0 },
        { cuentaContableId: 'c2', debito: 0, credito: 100 },
      ],
    };

    it('genera un reverso con débito/crédito invertidos y marca el original anulado', async () => {
      asientosRepository.buscarPorId.mockResolvedValue(asientoManual as never);
      asientosRepository.crear.mockResolvedValue({ id: 'reverso-1' } as never);

      await service.anular('a1', 'tenant-1');

      expect(asientosRepository.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          origen: 'ANULACION',
          origenId: 'a1',
          lineas: [
            { cuentaContableId: 'c1', debito: 0, credito: 100, descripcion: 'Anulación — asiento 5' },
            { cuentaContableId: 'c2', debito: 100, credito: 0, descripcion: 'Anulación — asiento 5' },
          ],
        }),
      );
      expect(asientosRepository.marcarAnulado).toHaveBeenCalledWith('a1');
    });

    it('rechaza anular un asiento de origen automático (ej. FACTURA)', async () => {
      asientosRepository.buscarPorId.mockResolvedValue({ ...asientoManual, origen: 'FACTURA' } as never);

      await expect(service.anular('a1', 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(asientosRepository.crear).not.toHaveBeenCalled();
      expect(asientosRepository.marcarAnulado).not.toHaveBeenCalled();
    });

    it('rechaza anular un asiento ya anulado', async () => {
      asientosRepository.buscarPorId.mockResolvedValue({ ...asientoManual, anulado: true } as never);

      await expect(service.anular('a1', 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(asientosRepository.crear).not.toHaveBeenCalled();
    });

    it('rechaza anular un asiento fechado en un período ya cerrado', async () => {
      asientosRepository.buscarPorId.mockResolvedValue(asientoManual as never);
      cierrePeriodoService.validarFechaAbierta.mockRejectedValue(new BadRequestException('cerrado'));

      await expect(service.anular('a1', 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(asientosRepository.crear).not.toHaveBeenCalled();
      expect(asientosRepository.marcarAnulado).not.toHaveBeenCalled();
    });
  });
});
