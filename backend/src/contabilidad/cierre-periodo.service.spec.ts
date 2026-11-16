import { BadRequestException } from '@nestjs/common';
import { CierrePeriodoService } from './cierre-periodo.service';
import { CierrePeriodoRepository } from './cierre-periodo.repository';
import { AsientosContablesRepository } from './asientos-contables.repository';
import { CuentasContablesRepository } from './cuentas-contables.repository';
import { CODIGOS_CUENTA } from './cuentas-base';

describe('CierrePeriodoService', () => {
  let service: CierrePeriodoService;
  let cierreRepository: jest.Mocked<CierrePeriodoRepository>;
  let asientosRepository: jest.Mocked<AsientosContablesRepository>;
  let cuentasRepository: jest.Mocked<CuentasContablesRepository>;

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
      listar: jest.fn(),
      crear: jest.fn(),
      cerrar: jest.fn().mockResolvedValue({ id: 'periodo-julio-cerrado' }),
    } as unknown as jest.Mocked<CierrePeriodoRepository>;
    asientosRepository = { lineasEnRango: jest.fn(), crear: jest.fn() } as unknown as jest.Mocked<AsientosContablesRepository>;
    cuentasRepository = { buscarPorCodigo: jest.fn().mockResolvedValue(cuentaUtilidades) } as unknown as jest.Mocked<CuentasContablesRepository>;
    service = new CierrePeriodoService(cierreRepository, asientosRepository, cuentasRepository);
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
});
