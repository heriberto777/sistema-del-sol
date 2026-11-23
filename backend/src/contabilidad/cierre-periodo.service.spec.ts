import { BadRequestException } from '@nestjs/common';
import { CierrePeriodoService } from './cierre-periodo.service';
import { CierrePeriodoRepository } from './cierre-periodo.repository';
import { AsientosContablesRepository } from './asientos-contables.repository';
import { CuentasContablesRepository } from './cuentas-contables.repository';
import { EstadosFinancierosService } from './estados-financieros.service';
import { BancosService } from '../bancos/bancos.service';
import { CODIGOS_CUENTA } from './cuentas-base';

describe('CierrePeriodoService', () => {
  let service: CierrePeriodoService;
  let cierreRepository: jest.Mocked<CierrePeriodoRepository>;
  let asientosRepository: jest.Mocked<AsientosContablesRepository>;
  let cuentasRepository: jest.Mocked<CuentasContablesRepository>;
  let estadosFinancierosService: jest.Mocked<EstadosFinancierosService>;
  let bancosService: jest.Mocked<BancosService>;

  const cuentaUtilidades = { id: 'cuenta-utilidades', codigo: CODIGOS_CUENTA.UTILIDADES_RETENIDAS, nombre: 'Utilidades Retenidas' };
  // UTC a propósito (no local) — rangoDelMes/rangoDelMesSiguiente trabajan
  // en UTC, para coincidir con cómo new Date(dto.fecha) parsea una fecha
  // suelta al crear un asiento (ver el comentario del propio util).
  const periodoJulio = { id: 'periodo-julio', fechaInicio: new Date('2026-07-01'), fechaFin: new Date('2026-07-31T23:59:59.999Z') };

  function linea(cuenta: { id: string; codigo: string; nombre: string; tipo: string }, debito: number, credito: number) {
    return { debito, credito, cuentaContable: cuenta };
  }

  beforeEach(() => {
    cierreRepository = {
      buscarPorFecha: jest.fn().mockResolvedValue(null),
      buscarAbiertoMasAntiguo: jest.fn().mockResolvedValue(periodoJulio),
      buscarMasReciente: jest.fn(),
      listar: jest.fn(),
      crear: jest.fn(),
      cerrar: jest.fn().mockResolvedValue({ id: 'periodo-julio-cerrado' }),
      buscarPorId: jest.fn().mockResolvedValue(periodoJulio),
      turnosSinCerrarEnRango: jest.fn().mockResolvedValue([]),
      cotizacionesSinConvertirEnRango: jest.fn().mockResolvedValue([]),
      remisionesSinFacturarEnRango: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<CierrePeriodoRepository>;
    asientosRepository = { lineasEnRango: jest.fn(), crear: jest.fn() } as unknown as jest.Mocked<AsientosContablesRepository>;
    cuentasRepository = {
      buscarPorCodigo: jest.fn().mockResolvedValue(cuentaUtilidades),
      resolverRolDeCuenta: jest.fn().mockResolvedValue(cuentaUtilidades),
    } as unknown as jest.Mocked<CuentasContablesRepository>;
    estadosFinancierosService = { conciliacionBancaria: jest.fn() } as unknown as jest.Mocked<EstadosFinancierosService>;
    bancosService = { listarTodasActivas: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<BancosService>;
    service = new CierrePeriodoService(cierreRepository, asientosRepository, cuentasRepository, estadosFinancierosService, bancosService);
  });

  describe('cerrarPeriodo', () => {
    it('rechaza cerrar si no hay ningún período abierto', async () => {
      cierreRepository.buscarAbiertoMasAntiguo.mockResolvedValue(null);

      await expect(service.cerrarPeriodo({ periodoId: 'periodo-julio' }, 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(asientosRepository.lineasEnRango).not.toHaveBeenCalled();
    });

    it('rechaza cerrar un período que no es el ABIERTO más antiguo', async () => {
      await expect(service.cerrarPeriodo({ periodoId: 'otro-periodo' }, 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(asientosRepository.lineasEnRango).not.toHaveBeenCalled();
    });

    it('rechaza cerrar si no hay movimientos de ingresos/gastos en el rango', async () => {
      asientosRepository.lineasEnRango.mockResolvedValue([]);

      await expect(service.cerrarPeriodo({ periodoId: 'periodo-julio' }, 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(asientosRepository.crear).not.toHaveBeenCalled();
    });

    it('Fase 2: rechaza cerrar un período que todavía no termina (cubre "hoy" o es futuro) — evita bloquear Facturación/POS/Compras/Nómina a mitad de mes', async () => {
      const dentroDeDiezAnios = new Date();
      dentroDeDiezAnios.setFullYear(dentroDeDiezAnios.getFullYear() + 10);
      const periodoEnCurso = { id: 'periodo-en-curso', fechaInicio: new Date(0), fechaFin: dentroDeDiezAnios };
      cierreRepository.buscarAbiertoMasAntiguo.mockResolvedValue(periodoEnCurso as never);

      await expect(service.cerrarPeriodo({ periodoId: 'periodo-en-curso' }, 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(asientosRepository.lineasEnRango).not.toHaveBeenCalled();
    });

    it('traspasa el saldo neto de INGRESO/GASTO a Utilidades Retenidas cuando hay utilidad (crédito)', async () => {
      const ingresos = { id: 'c1', codigo: '4010', nombre: 'Ingresos por Ventas', tipo: 'INGRESO' };
      const costo = { id: 'c2', codigo: '5010', nombre: 'Costo de Ventas', tipo: 'GASTO' };
      asientosRepository.lineasEnRango.mockResolvedValue([linea(ingresos, 0, 1000), linea(costo, 400, 0)] as never);
      asientosRepository.crear.mockResolvedValue({ id: 'asiento-cierre' } as never);

      await service.cerrarPeriodo({ periodoId: 'periodo-julio' }, 'tenant-1');

      const [desde, hasta] = asientosRepository.lineasEnRango.mock.calls[0];
      expect(desde).toBe(periodoJulio.fechaInicio);
      expect(hasta).toBe(periodoJulio.fechaFin);

      const [llamada] = asientosRepository.crear.mock.calls[0];
      expect(llamada.origen).toBe('CIERRE');
      expect(llamada.lineas).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ cuentaContableId: 'c1', debito: 1000, credito: 0 }),
          expect.objectContaining({ cuentaContableId: 'c2', debito: 0, credito: 400 }),
          expect.objectContaining({ cuentaContableId: 'cuenta-utilidades', debito: 0, credito: 600 }),
        ]),
      );
      const totalDebito = llamada.lineas.reduce((acc: number, l: { debito: number }) => acc + l.debito, 0);
      const totalCredito = llamada.lineas.reduce((acc: number, l: { credito: number }) => acc + l.credito, 0);
      expect(totalDebito).toBeCloseTo(totalCredito, 5);

      expect(cierreRepository.cerrar).toHaveBeenCalledWith('periodo-julio', { utilidadNeta: 600, asientoCierreId: 'asiento-cierre' });
    });

    it('debita Utilidades Retenidas cuando el período cierra con pérdida', async () => {
      const ingresos = { id: 'c1', codigo: '4010', nombre: 'Ingresos por Ventas', tipo: 'INGRESO' };
      const gasto = { id: 'c2', codigo: '5020', nombre: 'Gastos Operativos', tipo: 'GASTO' };
      asientosRepository.lineasEnRango.mockResolvedValue([linea(ingresos, 0, 300), linea(gasto, 500, 0)] as never);
      asientosRepository.crear.mockResolvedValue({ id: 'asiento-cierre' } as never);

      await service.cerrarPeriodo({ periodoId: 'periodo-julio' }, 'tenant-1');

      const [llamada] = asientosRepository.crear.mock.calls[0];
      expect(llamada.lineas).toEqual(
        expect.arrayContaining([expect.objectContaining({ cuentaContableId: 'cuenta-utilidades', debito: 200, credito: 0 })]),
      );
      expect(cierreRepository.cerrar).toHaveBeenCalledWith('periodo-julio', expect.objectContaining({ utilidadNeta: -200 }));
    });

    it('crea el período siguiente automáticamente si todavía no existe (cierre antes de que corra el cron)', async () => {
      asientosRepository.lineasEnRango.mockResolvedValue([linea({ id: 'c1', codigo: '4010', nombre: 'Ingresos', tipo: 'INGRESO' }, 0, 100)] as never);
      asientosRepository.crear.mockResolvedValue({ id: 'asiento-cierre' } as never);
      cierreRepository.buscarPorFecha.mockResolvedValue(null); // el período de agosto todavía no existe

      await service.cerrarPeriodo({ periodoId: 'periodo-julio' }, 'tenant-1');

      expect(cierreRepository.crear).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-1', fechaInicio: new Date('2026-08-01') }),
      );
    });

    it('bug real: calcula el siguiente a partir de fechaFin, no de fechaInicio (el primer período de un tenant con historial arranca en el epoch)', async () => {
      const periodoHistorico = { id: 'periodo-historico', fechaInicio: new Date(0), fechaFin: new Date('2026-07-31T23:59:59.999Z') };
      cierreRepository.buscarAbiertoMasAntiguo.mockResolvedValue(periodoHistorico as never);
      asientosRepository.lineasEnRango.mockResolvedValue([linea({ id: 'c1', codigo: '4010', nombre: 'Ingresos', tipo: 'INGRESO' }, 0, 100)] as never);
      asientosRepository.crear.mockResolvedValue({ id: 'asiento-cierre' } as never);
      cierreRepository.buscarPorFecha.mockResolvedValue(null);

      await service.cerrarPeriodo({ periodoId: 'periodo-historico' }, 'tenant-1');

      // Antes del fix, esto calculaba "el mes después de 1970" (inválido) en
      // vez de "el mes después de julio 2026" (agosto 2026, correcto).
      expect(cierreRepository.crear).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-1', fechaInicio: new Date('2026-08-01') }),
      );
    });

    it('NO crea el período siguiente si ya existe (lo creó el cron de antemano)', async () => {
      asientosRepository.lineasEnRango.mockResolvedValue([linea({ id: 'c1', codigo: '4010', nombre: 'Ingresos', tipo: 'INGRESO' }, 0, 100)] as never);
      asientosRepository.crear.mockResolvedValue({ id: 'asiento-cierre' } as never);
      cierreRepository.buscarPorFecha.mockResolvedValue({ id: 'periodo-agosto' } as never);

      await service.cerrarPeriodo({ periodoId: 'periodo-julio' }, 'tenant-1');

      expect(cierreRepository.crear).not.toHaveBeenCalled();
    });
  });

  describe('completarFaltantes', () => {
    // Fecha fija dentro del test para no depender del reloj real del CI —
    // "hoy" simulado: 2026-11-18 (el incidente real que originó este método).
    const hoy = new Date('2026-11-18T12:00:00.000Z');

    beforeEach(() => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      jest.setSystemTime(hoy);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('no crea nada si el período más reciente ya cubre hoy', async () => {
      cierreRepository.buscarMasReciente.mockResolvedValue({
        id: 'periodo-nov',
        fechaInicio: new Date('2026-11-01'),
        fechaFin: new Date('2026-11-30T23:59:59.999Z'),
      } as never);

      const creados = await service.completarFaltantes('tenant-1');

      expect(creados).toEqual([]);
      expect(cierreRepository.crear).not.toHaveBeenCalled();
      expect(cierreRepository.cerrar).not.toHaveBeenCalled();
    });

    it('crea el período faltante cuando el cron se saltó la ventana de fin de mes (incidente real)', async () => {
      cierreRepository.buscarMasReciente.mockResolvedValue({
        id: 'periodo-oct',
        fechaInicio: new Date('2026-10-01'),
        fechaFin: new Date('2026-10-31T23:59:59.999Z'),
      } as never);
      cierreRepository.crear.mockResolvedValue({
        id: 'periodo-nov',
        fechaInicio: new Date('2026-11-01'),
        fechaFin: new Date('2026-11-30T23:59:59.999Z'),
      } as never);

      const creados = await service.completarFaltantes('tenant-1');

      expect(cierreRepository.crear).toHaveBeenCalledTimes(1);
      expect(cierreRepository.crear).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-1', fechaInicio: new Date('2026-11-01') }),
      );
      expect(creados).toHaveLength(1);
    });

    it('crea TODOS los meses faltantes en orden si el hueco duró varios meses', async () => {
      cierreRepository.buscarMasReciente.mockResolvedValue({
        id: 'periodo-ago',
        fechaInicio: new Date('2026-08-01'),
        fechaFin: new Date('2026-08-31T23:59:59.999Z'),
      } as never);
      cierreRepository.crear
        .mockResolvedValueOnce({ id: 'p-sep', fechaInicio: new Date('2026-09-01'), fechaFin: new Date('2026-09-30T23:59:59.999Z') } as never)
        .mockResolvedValueOnce({ id: 'p-oct', fechaInicio: new Date('2026-10-01'), fechaFin: new Date('2026-10-31T23:59:59.999Z') } as never)
        .mockResolvedValueOnce({ id: 'p-nov', fechaInicio: new Date('2026-11-01'), fechaFin: new Date('2026-11-30T23:59:59.999Z') } as never);

      const creados = await service.completarFaltantes('tenant-1');

      expect(cierreRepository.crear).toHaveBeenCalledTimes(3);
      expect(creados.map((p) => p.id)).toEqual(['p-sep', 'p-oct', 'p-nov']);
    });

    it('defensivo: si el tenant no tiene ningún período, crea el de hoy directamente', async () => {
      cierreRepository.buscarMasReciente.mockResolvedValue(null);
      cierreRepository.crear.mockResolvedValue({ id: 'periodo-nov', fechaInicio: new Date('2026-11-01'), fechaFin: new Date('2026-11-30T23:59:59.999Z') } as never);

      const creados = await service.completarFaltantes('tenant-1');

      expect(cierreRepository.crear).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-1', fechaInicio: new Date('2026-11-01') }));
      expect(creados).toHaveLength(1);
    });

    it('no toca ni cierra los períodos ABIERTOS más viejos — crear y cerrar quedan desacoplados', async () => {
      cierreRepository.buscarMasReciente.mockResolvedValue({
        id: 'periodo-oct',
        fechaInicio: new Date('2026-10-01'),
        fechaFin: new Date('2026-10-31T23:59:59.999Z'),
      } as never);
      cierreRepository.crear.mockResolvedValue({ id: 'periodo-nov', fechaInicio: new Date('2026-11-01'), fechaFin: new Date('2026-11-30T23:59:59.999Z') } as never);

      await service.completarFaltantes('tenant-1');

      expect(cierreRepository.buscarAbiertoMasAntiguo).not.toHaveBeenCalled();
      expect(cierreRepository.cerrar).not.toHaveBeenCalled();
    });
  });

  describe('validarPeriodoAbierto', () => {
    it('rechaza si no hay ningún período definido para esa fecha', async () => {
      cierreRepository.buscarPorFecha.mockResolvedValue(null);

      await expect(service.validarPeriodoAbierto(new Date('2026-07-15'))).rejects.toThrow(BadRequestException);
    });

    it('rechaza si el período que cubre la fecha ya está CERRADO', async () => {
      cierreRepository.buscarPorFecha.mockResolvedValue({ estado: 'CERRADO' } as never);

      await expect(service.validarPeriodoAbierto(new Date('2026-07-15'))).rejects.toThrow(BadRequestException);
    });

    it('permite una fecha dentro de un período ABIERTO', async () => {
      cierreRepository.buscarPorFecha.mockResolvedValue({ estado: 'ABIERTO' } as never);

      await expect(service.validarPeriodoAbierto(new Date('2026-07-15'))).resolves.toBeUndefined();
    });
  });

  describe('asistentePrecierre (docs/PLAN.md — checklist informativo, nunca bloquea)', () => {
    it('descarta una cuenta bancaria con saldo pendiente ~0 (dentro de EPSILON) y conserva la que sí tiene pendiente real', async () => {
      bancosService.listarTodasActivas.mockResolvedValue([
        { id: 'banco-ok', banco: 'Banco OK', numeroCuenta: '111' },
        { id: 'banco-pendiente', banco: 'Banco Pendiente', numeroCuenta: '222' },
      ] as never);
      estadosFinancierosService.conciliacionBancaria.mockImplementation((async (cuentaBancariaId: string) => ({
        cuentaBancaria: { id: cuentaBancariaId, banco: cuentaBancariaId === 'banco-ok' ? 'Banco OK' : 'Banco Pendiente', numeroCuenta: '' },
        saldoPendiente: cuentaBancariaId === 'banco-ok' ? 0.001 : 1500,
      })) as never);

      const resultado = await service.asistentePrecierre('periodo-julio');

      expect(resultado.riesgosContables.conciliacionPendiente).toEqual([
        expect.objectContaining({ cuentaBancariaId: 'banco-pendiente', saldoPendiente: 1500 }),
      ]);
    });

    it('arma riesgosContables/pendientesComerciales a partir de lo que devuelve el repositorio', async () => {
      cierreRepository.turnosSinCerrarEnRango.mockResolvedValue([
        { id: 't1', bodega: { nombre: 'Principal' }, cajero: { nombre: 'Juan' }, abiertoEn: new Date('2026-07-10'), estado: 'ABIERTO' },
      ] as never);
      cierreRepository.cotizacionesSinConvertirEnRango.mockResolvedValue([
        { id: 'c1', numero: 'COT-001', cliente: { nombre: 'Cliente A' }, createdAt: new Date('2026-07-05'), total: 1000 },
      ] as never);
      cierreRepository.remisionesSinFacturarEnRango.mockResolvedValue([
        { id: 'r1', numero: 'REM-001', cliente: { nombre: 'Cliente B' }, fecha: new Date('2026-07-06') },
      ] as never);

      const resultado = await service.asistentePrecierre('periodo-julio');

      expect(resultado.riesgosContables.turnosSinCerrar).toEqual([
        expect.objectContaining({ id: 't1', bodega: 'Principal', cajero: 'Juan', estado: 'ABIERTO' }),
      ]);
      expect(resultado.pendientesComerciales.cotizacionesSinConvertir).toEqual([
        expect.objectContaining({ id: 'c1', numero: 'COT-001', cliente: 'Cliente A' }),
      ]);
      expect(resultado.pendientesComerciales.remisionesSinFacturar).toEqual([
        expect.objectContaining({ id: 'r1', numero: 'REM-001', cliente: 'Cliente B' }),
      ]);
    });

    it('consulta el rango exacto del período (fechaInicio/fechaFin), no un rango inventado', async () => {
      await service.asistentePrecierre('periodo-julio');

      expect(cierreRepository.turnosSinCerrarEnRango).toHaveBeenCalledWith(periodoJulio.fechaInicio, periodoJulio.fechaFin);
      expect(cierreRepository.cotizacionesSinConvertirEnRango).toHaveBeenCalledWith(periodoJulio.fechaInicio, periodoJulio.fechaFin);
      expect(cierreRepository.remisionesSinFacturarEnRango).toHaveBeenCalledWith(periodoJulio.fechaInicio, periodoJulio.fechaFin);
    });
  });
});
