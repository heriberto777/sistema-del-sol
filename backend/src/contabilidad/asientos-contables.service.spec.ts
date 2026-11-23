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
    cuentasRepository = {
      buscarPorCodigo: jest.fn(),
      buscarPorCodigoGlobal: jest.fn(),
      resolverRolDeCuenta: jest.fn(),
      listar: jest.fn(),
      crear: jest.fn(),
    } as unknown as jest.Mocked<CuentasContablesRepository>;
    cuentasRepository.buscarPorCodigoGlobal.mockImplementation(((_tenantId: string, codigo: string) => Promise.resolve(cuenta(codigo))) as never);
    // Sin override configurado (docs/PLAN.md, punto 4) — se comporta
    // igual que buscarPorCodigoGlobal, resolviendo por el código fijo
    // (3er argumento). Los tests de "override" lo sobreescriben puntual.
    cuentasRepository.resolverRolDeCuenta.mockImplementation(((_tenantId: string, _clave: string, codigoFijo: string) => Promise.resolve(cuenta(codigoFijo))) as never);
    cierrePeriodoService = { validarPeriodoAbierto: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<CierrePeriodoService>;
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
      cierrePeriodoService.validarPeriodoAbierto.mockRejectedValue(new BadRequestException('cerrado'));

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
      expect(cierrePeriodoService.validarPeriodoAbierto).toHaveBeenCalledWith(new Date('2026-07-15'));
    });
  });

  describe('generarDesdeFactura', () => {
    it('CONTADO debita Caja, acredita Ingresos e ITBIS por Pagar', async () => {
      asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);

      await service.generarDesdeFactura({
        tenantId: 't1',
        facturaId: 'f1',
        tipoFactura: 'CONTADO',
        itbis: 54,
        total: 354,
        ingresosPorCuenta: [{ cuentaContableId: null, monto: 300 }],
      });

      expect(cuentasRepository.resolverRolDeCuenta).toHaveBeenCalledWith('t1', 'CAJA_BANCOS', CODIGOS_CUENTA.CAJA_BANCOS);
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

      await service.generarDesdeFactura({
        tenantId: 't1',
        facturaId: 'f1',
        tipoFactura: 'CREDITO',
        itbis: 54,
        total: 354,
        ingresosPorCuenta: [{ cuentaContableId: null, monto: 300 }],
      });

      expect(cuentasRepository.resolverRolDeCuenta).toHaveBeenCalledWith('t1', 'CUENTAS_POR_COBRAR', CODIGOS_CUENTA.CUENTAS_POR_COBRAR);
    });

    it('NOTA_CREDITO (montos ya negativos) invierte débito/crédito y sigue balanceando', async () => {
      asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);

      await service.generarDesdeFactura({
        tenantId: 't1',
        facturaId: 'nc1',
        tipoFactura: 'NOTA_CREDITO',
        itbis: -54,
        total: -354,
        ingresosPorCuenta: [{ cuentaContableId: null, monto: -300 }],
      });

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

      await service.generarDesdeFactura({
        tenantId: 't1',
        facturaId: 'f1',
        tipoFactura: 'CONTADO',
        itbis: 0,
        total: 100,
        ingresosPorCuenta: [{ cuentaContableId: null, monto: 100 }],
      });

      const [llamada] = asientosRepository.crearGlobal.mock.calls[0];
      expect(llamada.lineas).toHaveLength(2);
    });

    it('ítem B-4: sin `recargos`, el crédito a Ingresos NO cubre un total que sí los incluye — bug real, encontrado verificando B-4 en vivo', async () => {
      asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);
      // subtotal (líneas) 299.70 + itbis 62.95 (línea + recargo) + recargo crudo 50 = total 412.65
      await service.generarDesdeFactura({
        tenantId: 't1',
        facturaId: 'f1',
        tipoFactura: 'CONTADO',
        itbis: 62.95,
        total: 412.65,
        recargos: 50,
        ingresosPorCuenta: [{ cuentaContableId: null, monto: 299.7 }],
      });

      const [llamada] = asientosRepository.crearGlobal.mock.calls[0];
      const lineas = llamada.lineas;
      expect(lineas).toEqual(
        expect.arrayContaining([expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.INGRESOS_POR_VENTAS}`, credito: 349.7 })]),
      );
      const totalDebito = lineas.reduce((acc: number, l: { debito: number }) => acc + l.debito, 0);
      const totalCredito = lineas.reduce((acc: number, l: { credito: number }) => acc + l.credito, 0);
      expect(totalDebito).toBeCloseTo(totalCredito, 5);
    });

    describe('parametrización de cuentas por categoría (docs/PLAN.md, punto 2)', () => {
      it('con varios grupos de ingreso (categorías distintas), genera una línea de crédito por cada cuenta involucrada', async () => {
        asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);

        await service.generarDesdeFactura({
          tenantId: 't1',
          facturaId: 'f1',
          tipoFactura: 'CONTADO',
          itbis: 54,
          total: 354,
          ingresosPorCuenta: [
            { cuentaContableId: 'cuenta-ingreso-servicios', monto: 100 },
            { cuentaContableId: 'cuenta-ingreso-mercaderia', monto: 150 },
            { cuentaContableId: null, monto: 50 }, // producto sin categoría con cuenta propia -> genérica
          ],
        });

        const [llamada] = asientosRepository.crearGlobal.mock.calls[0];
        const lineas = llamada.lineas;
        expect(lineas).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ cuentaContableId: 'cuenta-ingreso-servicios', credito: 100 }),
            expect.objectContaining({ cuentaContableId: 'cuenta-ingreso-mercaderia', credito: 150 }),
            expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.INGRESOS_POR_VENTAS}`, credito: 50 }),
          ]),
        );
        const totalDebito = lineas.reduce((acc: number, l: { debito: number }) => acc + l.debito, 0);
        const totalCredito = lineas.reduce((acc: number, l: { credito: number }) => acc + l.credito, 0);
        expect(totalDebito).toBeCloseTo(totalCredito, 5);
      });

      it('los recargos siempre van a la cuenta genérica, nunca a una cuenta de categoría', async () => {
        asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);

        await service.generarDesdeFactura({
          tenantId: 't1',
          facturaId: 'f1',
          tipoFactura: 'CONTADO',
          itbis: 54,
          total: 404,
          recargos: 50,
          ingresosPorCuenta: [{ cuentaContableId: 'cuenta-ingreso-servicios', monto: 300 }],
        });

        const [llamada] = asientosRepository.crearGlobal.mock.calls[0];
        expect(llamada.lineas).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ cuentaContableId: 'cuenta-ingreso-servicios', credito: 300 }),
            expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.INGRESOS_POR_VENTAS}`, credito: 50 }),
          ]),
        );
      });

      it('dos grupos con la misma cuenta se funden en una sola línea (no duplica la cuenta)', async () => {
        asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);

        await service.generarDesdeFactura({
          tenantId: 't1',
          facturaId: 'f1',
          tipoFactura: 'CONTADO',
          itbis: 0,
          total: 300,
          ingresosPorCuenta: [
            { cuentaContableId: 'cuenta-ingreso-servicios', monto: 100 },
            { cuentaContableId: 'cuenta-ingreso-servicios', monto: 200 },
          ],
        });

        const [llamada] = asientosRepository.crearGlobal.mock.calls[0];
        const lineasIngreso = llamada.lineas.filter((l: { cuentaContableId: string }) => l.cuentaContableId === 'cuenta-ingreso-servicios');
        expect(lineasIngreso).toHaveLength(1);
        expect(lineasIngreso[0].credito).toBe(300);
      });
    });

    describe('motor de costeo (Costo de Ventas)', () => {
      it('con costosPorCuenta, agrega Débito Costo de Ventas / Crédito Inventario y sigue balanceando', async () => {
        asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);

        await service.generarDesdeFactura({
          tenantId: 't1',
          facturaId: 'f1',
          tipoFactura: 'CONTADO',
          itbis: 54,
          total: 354,
          ingresosPorCuenta: [{ cuentaContableId: null, monto: 300 }],
          costosPorCuenta: [{ cuentaContableId: null, monto: 180 }],
        });

        const [llamada] = asientosRepository.crearGlobal.mock.calls[0];
        const lineas = llamada.lineas;
        expect(lineas).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.COSTO_DE_VENTAS}`, debito: 180 }),
            expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.INVENTARIO}`, credito: 180 }),
          ]),
        );
        const totalDebito = lineas.reduce((acc: number, l: { debito: number }) => acc + l.debito, 0);
        const totalCredito = lineas.reduce((acc: number, l: { credito: number }) => acc + l.credito, 0);
        expect(totalDebito).toBeCloseTo(totalCredito, 5);
      });

      it('con una cuenta de costo propia por categoría, debita esa cuenta en vez de la genérica', async () => {
        asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);

        await service.generarDesdeFactura({
          tenantId: 't1',
          facturaId: 'f1',
          tipoFactura: 'CONTADO',
          itbis: 54,
          total: 354,
          ingresosPorCuenta: [{ cuentaContableId: null, monto: 300 }],
          costosPorCuenta: [{ cuentaContableId: 'cuenta-costo-servicios', monto: 180 }],
        });

        const [llamada] = asientosRepository.crearGlobal.mock.calls[0];
        expect(llamada.lineas).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ cuentaContableId: 'cuenta-costo-servicios', debito: 180 }),
            expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.INVENTARIO}`, credito: 180 }),
          ]),
        );
        expect(cuentasRepository.resolverRolDeCuenta).not.toHaveBeenCalledWith('t1', 'COSTO_DE_VENTAS', CODIGOS_CUENTA.COSTO_DE_VENTAS);
      });

      it('sin costosPorCuenta (SERVICIO, línea manual, NOTA_DEBITO), no agrega ninguna línea de Costo de Ventas', async () => {
        asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);

        await service.generarDesdeFactura({
          tenantId: 't1',
          facturaId: 'f1',
          tipoFactura: 'CONTADO',
          itbis: 54,
          total: 354,
          ingresosPorCuenta: [{ cuentaContableId: null, monto: 300 }],
        });

        const [llamada] = asientosRepository.crearGlobal.mock.calls[0];
        expect(llamada.lineas).toHaveLength(3);
        expect(cuentasRepository.resolverRolDeCuenta).not.toHaveBeenCalledWith('t1', 'COSTO_DE_VENTAS', CODIGOS_CUENTA.COSTO_DE_VENTAS);
      });

      it('NOTA_CREDITO con costosPorCuenta negativo invierte Costo de Ventas/Inventario también', async () => {
        asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);

        await service.generarDesdeFactura({
          tenantId: 't1',
          facturaId: 'nc1',
          tipoFactura: 'NOTA_CREDITO',
          itbis: -54,
          total: -354,
          ingresosPorCuenta: [{ cuentaContableId: null, monto: -300 }],
          costosPorCuenta: [{ cuentaContableId: null, monto: -180 }],
        });

        const [llamada] = asientosRepository.crearGlobal.mock.calls[0];
        expect(llamada.lineas).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.COSTO_DE_VENTAS}`, credito: 180 }),
            expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.INVENTARIO}`, debito: 180 }),
          ]),
        );
      });
    });
  });

  describe('generarReversaFactura', () => {
    it('genera el asiento contrario exacto (montos negados)', async () => {
      asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);

      await service.generarReversaFactura({
        tenantId: 't1',
        facturaId: 'f1',
        tipoFactura: 'CONTADO',
        itbis: 54,
        total: 354,
        ingresosPorCuenta: [{ cuentaContableId: null, monto: 300 }],
      });

      const [llamada] = asientosRepository.crearGlobal.mock.calls[0];
      const lineas = llamada.lineas;
      // ahora Caja va en crédito (se revierte la entrada de dinero)
      expect(lineas).toEqual(
        expect.arrayContaining([expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.CAJA_BANCOS}`, credito: 354 })]),
      );
    });

    it('ítem B-4: niega también los recargos, la reversa sigue balanceando', async () => {
      asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);

      await service.generarReversaFactura({
        tenantId: 't1',
        facturaId: 'f1',
        tipoFactura: 'CONTADO',
        itbis: 62.95,
        total: 412.65,
        recargos: 50,
        ingresosPorCuenta: [{ cuentaContableId: null, monto: 299.7 }],
      });

      const [llamada] = asientosRepository.crearGlobal.mock.calls[0];
      const lineas = llamada.lineas;
      const totalDebito = lineas.reduce((acc: number, l: { debito: number }) => acc + l.debito, 0);
      const totalCredito = lineas.reduce((acc: number, l: { credito: number }) => acc + l.credito, 0);
      expect(totalDebito).toBeCloseTo(totalCredito, 5);
    });

    it('niega también costosPorCuenta — la reversa de Costo de Ventas/Inventario sale invertida', async () => {
      asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);

      await service.generarReversaFactura({
        tenantId: 't1',
        facturaId: 'f1',
        tipoFactura: 'CONTADO',
        itbis: 54,
        total: 354,
        ingresosPorCuenta: [{ cuentaContableId: null, monto: 300 }],
        costosPorCuenta: [{ cuentaContableId: null, monto: 180 }],
      });

      const [llamada] = asientosRepository.crearGlobal.mock.calls[0];
      expect(llamada.lineas).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.COSTO_DE_VENTAS}`, credito: 180 }),
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.INVENTARIO}`, debito: 180 }),
        ]),
      );
    });

    it('con una cuenta de ingreso propia por categoría, niega esa cuenta específica (no la genérica)', async () => {
      asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);

      await service.generarReversaFactura({
        tenantId: 't1',
        facturaId: 'f1',
        tipoFactura: 'CONTADO',
        itbis: 54,
        total: 354,
        ingresosPorCuenta: [{ cuentaContableId: 'cuenta-ingreso-servicios', monto: 300 }],
      });

      const [llamada] = asientosRepository.crearGlobal.mock.calls[0];
      expect(llamada.lineas).toEqual(
        expect.arrayContaining([expect.objectContaining({ cuentaContableId: 'cuenta-ingreso-servicios', debito: 300 })]),
      );
    });
  });

  describe('generarDesdeCompra', () => {
    it('debita Inventario e ITBIS Adelantado, acredita Cuentas por Pagar por el total', async () => {
      asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);

      await service.generarDesdeCompra({
        tenantId: 't1',
        recepcionId: 'r1',
        itbis: 36,
        inventarioPorCentro: [{ centroCostoId: null, monto: 200 }],
      });

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

    it('con varios centros de costo, genera una línea de débito a Inventario por cada uno (docs/PLAN.md, punto 3)', async () => {
      asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);

      await service.generarDesdeCompra({
        tenantId: 't1',
        recepcionId: 'r1',
        itbis: 0,
        inventarioPorCentro: [
          { centroCostoId: 'centro-santiago', monto: 120 },
          { centroCostoId: 'centro-santo-domingo', monto: 80 },
        ],
      });

      const [llamada] = asientosRepository.crearGlobal.mock.calls[0];
      const lineas = llamada.lineas;
      expect(lineas).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.INVENTARIO}`, centroCostoId: 'centro-santiago', debito: 120 }),
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.INVENTARIO}`, centroCostoId: 'centro-santo-domingo', debito: 80 }),
          expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.CUENTAS_POR_PAGAR}`, credito: 200 }),
        ]),
      );
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

      expect(cuentasRepository.resolverRolDeCuenta).toHaveBeenCalledWith('t1', 'GASTOS_DE_NOMINA', CODIGOS_CUENTA.GASTOS_DE_NOMINA);
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

    it('con cuentaCajaId (banco real elegido al cobrar), debita esa cuenta en vez de la genérica Caja/Bancos', async () => {
      asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);

      await service.generarDesdePagoFactura({ tenantId: 't1', pagoId: 'pago-1', monto: 200, cuentaCajaId: 'banco-real-1' });

      const [llamada] = asientosRepository.crearGlobal.mock.calls[0];
      expect(llamada.lineas).toEqual(
        expect.arrayContaining([expect.objectContaining({ cuentaContableId: 'banco-real-1', debito: 200 })]),
      );
      expect(llamada.lineas).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.CAJA_BANCOS}` })]),
      );
      // No debería ni consultar la cuenta genérica si ya le dieron una puntual.
      expect(cuentasRepository.resolverRolDeCuenta).not.toHaveBeenCalledWith('t1', 'CAJA_BANCOS', CODIGOS_CUENTA.CAJA_BANCOS);
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

    it('con cuentaCajaId (banco real elegido al pagar), acredita esa cuenta en vez de la genérica Caja/Bancos', async () => {
      asientosRepository.crearGlobal.mockResolvedValue({ id: 'a1' } as never);

      await service.generarDesdePagoOrdenCompra({ tenantId: 't1', pagoId: 'pago-1', monto: 500, cuentaCajaId: 'banco-real-2' });

      const [llamada] = asientosRepository.crearGlobal.mock.calls[0];
      expect(llamada.lineas).toEqual(
        expect.arrayContaining([expect.objectContaining({ cuentaContableId: 'banco-real-2', credito: 500 })]),
      );
      expect(llamada.lineas).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ cuentaContableId: `cuenta-${CODIGOS_CUENTA.CAJA_BANCOS}` })]),
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
      cierrePeriodoService.validarPeriodoAbierto.mockRejectedValue(new BadRequestException('cerrado'));

      await expect(service.anular('a1', 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(asientosRepository.crear).not.toHaveBeenCalled();
      expect(asientosRepository.marcarAnulado).not.toHaveBeenCalled();
    });
  });
});
