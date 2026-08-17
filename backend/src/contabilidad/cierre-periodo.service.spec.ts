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

  function linea(cuenta: { id: string; codigo: string; nombre: string; tipo: string }, debito: number, credito: number) {
    return { debito, credito, cuentaContable: cuenta };
  }

  beforeEach(() => {
    cierreRepository = { buscarUltimo: jest.fn().mockResolvedValue(null), listar: jest.fn(), crear: jest.fn() } as unknown as jest.Mocked<CierrePeriodoRepository>;
    asientosRepository = { lineasEnRango: jest.fn(), crear: jest.fn() } as unknown as jest.Mocked<AsientosContablesRepository>;
    cuentasRepository = { buscarPorCodigo: jest.fn().mockResolvedValue(cuentaUtilidades) } as unknown as jest.Mocked<CuentasContablesRepository>;
    service = new CierrePeriodoService(cierreRepository, asientosRepository, cuentasRepository);
  });

  it('rechaza cerrar si no hay movimientos de ingresos/gastos en el rango', async () => {
    asientosRepository.lineasEnRango.mockResolvedValue([]);

    await expect(service.cerrarPeriodo({ fecha: '2026-07-31' }, 'tenant-1')).rejects.toThrow(BadRequestException);
    expect(asientosRepository.crear).not.toHaveBeenCalled();
  });

  it('rechaza cerrar en o antes del último cierre', async () => {
    cierreRepository.buscarUltimo.mockResolvedValue({ fecha: new Date('2026-07-31') } as never);

    await expect(service.cerrarPeriodo({ fecha: '2026-07-15' }, 'tenant-1')).rejects.toThrow(BadRequestException);
    expect(asientosRepository.lineasEnRango).not.toHaveBeenCalled();
  });

  it('traspasa el saldo neto de INGRESO/GASTO a Utilidades Retenidas cuando hay utilidad (crédito)', async () => {
    const ingresos = { id: 'c1', codigo: '4010', nombre: 'Ingresos por Ventas', tipo: 'INGRESO' };
    const costo = { id: 'c2', codigo: '5010', nombre: 'Costo de Ventas', tipo: 'GASTO' };
    asientosRepository.lineasEnRango.mockResolvedValue([linea(ingresos, 0, 1000), linea(costo, 400, 0)] as never);
    asientosRepository.crear.mockResolvedValue({ id: 'asiento-cierre' } as never);
    cierreRepository.crear.mockResolvedValue({ id: 'cierre-1' } as never);

    await service.cerrarPeriodo({ fecha: '2026-07-31' }, 'tenant-1');

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

    expect(cierreRepository.crear).toHaveBeenCalledWith({ tenantId: 'tenant-1', fecha: new Date('2026-07-31'), utilidadNeta: 600, asientoCierreId: 'asiento-cierre' });
  });

  it('debita Utilidades Retenidas cuando el período cierra con pérdida', async () => {
    const ingresos = { id: 'c1', codigo: '4010', nombre: 'Ingresos por Ventas', tipo: 'INGRESO' };
    const gasto = { id: 'c2', codigo: '5020', nombre: 'Gastos Operativos', tipo: 'GASTO' };
    asientosRepository.lineasEnRango.mockResolvedValue([linea(ingresos, 0, 300), linea(gasto, 500, 0)] as never);
    asientosRepository.crear.mockResolvedValue({ id: 'asiento-cierre' } as never);

    await service.cerrarPeriodo({ fecha: '2026-07-31' }, 'tenant-1');

    const [llamada] = asientosRepository.crear.mock.calls[0];
    expect(llamada.lineas).toEqual(
      expect.arrayContaining([expect.objectContaining({ cuentaContableId: 'cuenta-utilidades', debito: 200, credito: 0 })]),
    );
    expect(cierreRepository.crear).toHaveBeenCalledWith(expect.objectContaining({ utilidadNeta: -200 }));
  });

  it('solo considera movimientos desde el último cierre (exclusive) hasta la nueva fecha', async () => {
    cierreRepository.buscarUltimo.mockResolvedValue({ fecha: new Date('2026-06-30') } as never);
    asientosRepository.lineasEnRango.mockResolvedValue([{ debito: 0, credito: 100, cuentaContable: { id: 'c1', codigo: '4010', nombre: 'Ingresos', tipo: 'INGRESO' } }] as never);
    asientosRepository.crear.mockResolvedValue({ id: 'asiento-cierre' } as never);

    await service.cerrarPeriodo({ fecha: '2026-07-31' }, 'tenant-1');

    const [desde, hasta] = asientosRepository.lineasEnRango.mock.calls[0];
    expect(desde.getTime()).toBe(new Date('2026-06-30').getTime() + 1);
    const finDelDiaEsperado = new Date('2026-07-31');
    finDelDiaEsperado.setHours(23, 59, 59, 999);
    expect(hasta.getTime()).toBe(finDelDiaEsperado.getTime());
  });

  it('incluye los movimientos del propio día de corte (no solo hasta la medianoche)', async () => {
    const ingresos = { id: 'c1', codigo: '4010', nombre: 'Ingresos por Ventas', tipo: 'INGRESO' };
    asientosRepository.lineasEnRango.mockResolvedValue([linea(ingresos, 0, 500)] as never);
    asientosRepository.crear.mockResolvedValue({ id: 'asiento-cierre' } as never);

    await service.cerrarPeriodo({ fecha: '2026-07-31' }, 'tenant-1');

    const [, hasta] = asientosRepository.lineasEnRango.mock.calls[0];
    expect(hasta.getHours()).toBe(23);
    expect(hasta.getMinutes()).toBe(59);
  });

  describe('validarFechaAbierta', () => {
    it('no rechaza nada si todavía no hay ningún cierre', async () => {
      cierreRepository.buscarUltimo.mockResolvedValue(null);

      await expect(service.validarFechaAbierta(new Date('2020-01-01'))).resolves.toBeUndefined();
    });

    it('rechaza una fecha en o antes del último cierre', async () => {
      cierreRepository.buscarUltimo.mockResolvedValue({ fecha: new Date('2026-06-30') } as never);

      await expect(service.validarFechaAbierta(new Date('2026-06-15'))).rejects.toThrow(BadRequestException);
      await expect(service.validarFechaAbierta(new Date('2026-06-30'))).rejects.toThrow(BadRequestException);
    });

    it('permite una fecha después del último cierre', async () => {
      cierreRepository.buscarUltimo.mockResolvedValue({ fecha: new Date('2026-06-30') } as never);

      await expect(service.validarFechaAbierta(new Date('2026-07-01'))).resolves.toBeUndefined();
    });
  });
});
