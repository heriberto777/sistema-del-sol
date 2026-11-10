import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GastosMenoresService } from './gastos-menores.service';
import { GastosMenoresRepository } from './gastos-menores.repository';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { CierrePeriodoService } from '../contabilidad/cierre-periodo.service';
import { CuentasContablesService } from '../contabilidad/cuentas-contables.service';
import { BancosService } from '../bancos/bancos.service';

describe('GastosMenoresService', () => {
  let service: GastosMenoresService;
  let repository: jest.Mocked<GastosMenoresRepository>;
  let tenantPrisma: { client: { $transaction: jest.Mock } };
  let eventBus: jest.Mocked<EventBusService>;
  let cierrePeriodoService: jest.Mocked<CierrePeriodoService>;
  let cuentasContablesService: jest.Mocked<CuentasContablesService>;
  let bancosService: jest.Mocked<BancosService>;

  const TX = { esTransaccion: true };

  beforeEach(() => {
    repository = {
      obtenerModalidadFacturacion: jest.fn().mockResolvedValue('NCF'),
      siguienteNumeroEnTx: jest.fn().mockResolvedValue('B1100000001'),
      crearEnTx: jest.fn(),
      listar: jest.fn(),
      buscarPorId: jest.fn(),
    } as unknown as jest.Mocked<GastosMenoresRepository>;
    tenantPrisma = { client: { $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(TX)) } };
    eventBus = { emit: jest.fn(), on: jest.fn() } as unknown as jest.Mocked<EventBusService>;
    cierrePeriodoService = { validarFechaAbierta: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<CierrePeriodoService>;
    cuentasContablesService = { listar: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<CuentasContablesService>;
    bancosService = { listarTodasActivas: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<BancosService>;
    service = new GastosMenoresService(
      repository,
      tenantPrisma as unknown as TenantPrismaService,
      eventBus,
      cierrePeriodoService,
      cuentasContablesService,
      bancosService,
    );
  });

  function dto(overrides: Partial<Parameters<GastosMenoresService['crear']>[0]> = {}) {
    return {
      cuentaBancariaId: 'banco-1',
      lineas: [{ cuentaContableId: 'gasto-1', valor: 100, porcentajeItbis: 18, cantidad: 2 }],
      ...overrides,
    } as Parameters<GastosMenoresService['crear']>[0];
  }

  it('calcula ITBIS y total por línea (valor * cantidad * %), y los agrega para el total del gasto', async () => {
    repository.crearEnTx.mockResolvedValue({ id: 'gm1' } as never);

    await service.crear(dto(), 'tenant-1');

    // 100 * 2 = 200 base; itbis 18% de 200 = 36; total línea = 236
    expect(repository.crearEnTx).toHaveBeenCalledWith(
      TX,
      expect.objectContaining({
        monto: 200,
        itbis: 36,
        total: 236,
        lineas: [expect.objectContaining({ valor: 100, cantidad: 2, montoItbis: 36, montoTotal: 236 })],
      }),
    );
  });

  it('suma varias líneas con distinto ITBIS cada una', async () => {
    repository.crearEnTx.mockResolvedValue({ id: 'gm1' } as never);

    await service.crear(
      dto({
        lineas: [
          { cuentaContableId: 'gasto-1', valor: 100, porcentajeItbis: 18, cantidad: 1 },
          { cuentaContableId: 'gasto-2', valor: 50, porcentajeItbis: 0, cantidad: 1 },
        ],
      }),
      'tenant-1',
    );

    const [, llamada] = repository.crearEnTx.mock.calls[0];
    expect(llamada.monto).toBe(150);
    expect(llamada.itbis).toBe(18);
    expect(llamada.total).toBe(168);
  });

  it('sin porcentajeItbis/cantidad explícitos, asume 0% y cantidad 1', async () => {
    repository.crearEnTx.mockResolvedValue({ id: 'gm1' } as never);

    await service.crear(dto({ lineas: [{ cuentaContableId: 'gasto-1', valor: 100 }] }), 'tenant-1');

    const [, llamada] = repository.crearEnTx.mock.calls[0];
    expect(llamada.monto).toBe(100);
    expect(llamada.itbis).toBe(0);
  });

  it('modalidad NCF pide un tipo B11', async () => {
    repository.crearEnTx.mockResolvedValue({ id: 'gm1' } as never);

    await service.crear(dto(), 'tenant-1');

    expect(repository.siguienteNumeroEnTx).toHaveBeenCalledWith(TX, 'B11');
  });

  it('modalidad ECF pide un tipo E43 en vez de B11', async () => {
    repository.obtenerModalidadFacturacion.mockResolvedValue('ECF' as never);
    repository.crearEnTx.mockResolvedValue({ id: 'gm1' } as never);

    await service.crear(dto(), 'tenant-1');

    expect(repository.siguienteNumeroEnTx).toHaveBeenCalledWith(TX, 'E43');
  });

  it('emite GASTO_MENOR_CREADO tras crearlo', async () => {
    repository.crearEnTx.mockResolvedValue({ id: 'gm1' } as never);

    await service.crear(dto(), 'tenant-1');

    expect(eventBus.emit).toHaveBeenCalledWith(EVENTOS.GASTO_MENOR_CREADO, { tenantId: 'tenant-1', gastoMenorId: 'gm1' });
  });

  it('asignación del NCF y creación del gasto corren dentro de la misma transacción', async () => {
    repository.crearEnTx.mockResolvedValue({ id: 'gm1' } as never);

    await service.crear(dto(), 'tenant-1');

    expect(tenantPrisma.client.$transaction).toHaveBeenCalledTimes(1);
    expect(repository.siguienteNumeroEnTx).toHaveBeenCalledWith(TX, expect.anything());
    expect(repository.crearEnTx).toHaveBeenCalledWith(TX, expect.anything());
  });

  it('rechaza un gasto menor fechado en un período contable ya cerrado', async () => {
    cierrePeriodoService.validarFechaAbierta.mockRejectedValue(new BadRequestException('cerrado'));

    await expect(service.crear(dto({ fecha: '2026-01-01' }), 'tenant-1')).rejects.toThrow(BadRequestException);
    expect(repository.crearEnTx).not.toHaveBeenCalled();
  });

  it('listar delega en el repositorio con paginación', async () => {
    repository.listar.mockResolvedValue([[{ id: 'gm1' }], 1] as never);

    const resultado = await service.listar({ pagina: 1, tamanoPagina: 20 } as never);

    expect(resultado).toEqual({ datos: [{ id: 'gm1' }], total: 1, pagina: 1, tamanoPagina: 20 });
  });

  describe('importar', () => {
    const BANCO_1 = { id: 'banco-1', banco: 'Banreservas', numeroCuenta: '1111' };
    const BANCO_2_MISMO_NOMBRE_A = { id: 'banco-2a', banco: 'Popular', numeroCuenta: '2222' };
    const BANCO_2_MISMO_NOMBRE_B = { id: 'banco-2b', banco: 'Popular', numeroCuenta: '3333' };
    const CUENTA_GASTO = { id: 'cuenta-gasto-1', codigo: '5021', nombre: 'Alquiler', tipo: 'GASTO' };
    const CUENTA_ACTIVO = { id: 'cuenta-activo-1', codigo: '1010', nombre: 'Caja y Bancos', tipo: 'ACTIVO' };

    function filaValida(overrides: Partial<Parameters<GastosMenoresService['importar']>[0]['gastos'][0]> = {}) {
      return { cuentaBancaria: 'Banreservas — 1111', cuentaContable: '5021', valor: 100, ...overrides };
    }

    beforeEach(() => {
      bancosService.listarTodasActivas.mockResolvedValue([BANCO_1, BANCO_2_MISMO_NOMBRE_A, BANCO_2_MISMO_NOMBRE_B] as never);
      cuentasContablesService.listar.mockResolvedValue([CUENTA_GASTO, CUENTA_ACTIVO] as never);
      repository.crearEnTx.mockResolvedValue({ id: 'gm1' } as never);
    });

    it('fila válida: resuelve cuentaBancaria/cuentaContable por texto y crea el gasto', async () => {
      const resultado = await service.importar({ gastos: [filaValida()] }, 'tenant-1');

      expect(resultado).toEqual({ creados: 1, errores: [] });
      expect(repository.crearEnTx).toHaveBeenCalledWith(
        TX,
        expect.objectContaining({ cuentaBancariaId: 'banco-1', lineas: [expect.objectContaining({ cuentaContableId: 'cuenta-gasto-1' })] }),
      );
    });

    it('resuelve la cuenta contable por nombre además de por código', async () => {
      const resultado = await service.importar({ gastos: [filaValida({ cuentaContable: 'Alquiler' })] }, 'tenant-1');

      expect(resultado.errores).toEqual([]);
      expect(repository.crearEnTx).toHaveBeenCalledWith(TX, expect.objectContaining({ lineas: [expect.objectContaining({ cuentaContableId: 'cuenta-gasto-1' })] }));
    });

    it('resuelve la cuenta bancaria por solo el nombre del banco cuando no es ambiguo', async () => {
      const resultado = await service.importar({ gastos: [filaValida({ cuentaBancaria: 'Banreservas' })] }, 'tenant-1');

      expect(resultado.errores).toEqual([]);
      expect(repository.crearEnTx).toHaveBeenCalledWith(TX, expect.objectContaining({ cuentaBancariaId: 'banco-1' }));
    });

    it('banco ambiguo (2 cuentas con el mismo nombre) sin el número de cuenta: error claro, no aborta el resto', async () => {
      const resultado = await service.importar({ gastos: [filaValida({ cuentaBancaria: 'Popular' })] }, 'tenant-1');

      expect(resultado.creados).toBe(0);
      expect(resultado.errores).toEqual([{ fila: 2, mensaje: expect.stringContaining('ambiguo') }]);
    });

    it('cuenta contable que existe pero no es de tipo Gasto: error específico', async () => {
      const resultado = await service.importar({ gastos: [filaValida({ cuentaContable: '1010' })] }, 'tenant-1');

      expect(resultado.errores).toEqual([{ fila: 2, mensaje: expect.stringContaining('no es una cuenta de tipo Gasto') }]);
      expect(repository.crearEnTx).not.toHaveBeenCalled();
    });

    it('cuenta bancaria o contable que no existe: error por fila, sin abortar las demás', async () => {
      const resultado = await service.importar(
        { gastos: [filaValida({ cuentaBancaria: 'Banco inexistente' }), filaValida()] },
        'tenant-1',
      );

      expect(resultado).toEqual({ creados: 1, errores: [{ fila: 2, mensaje: expect.stringContaining('no encontrada') }] });
    });

    it('reporta el número de fila real del Excel (encabezado = fila 1, primera de datos = fila 2)', async () => {
      const resultado = await service.importar({ gastos: [filaValida(), filaValida({ cuentaContable: 'no-existe' })] }, 'tenant-1');

      expect(resultado.errores).toEqual([{ fila: 3, mensaje: expect.any(String) }]);
    });

    it('secuencia de NCF agotada a mitad de la corrida: corta ahí y marca el resto como no procesadas, sin reintentar fila por fila', async () => {
      repository.siguienteNumeroEnTx
        .mockResolvedValueOnce('B1100000001')
        .mockRejectedValueOnce(new Error('Secuencia de NCF B11 agotada'));

      const resultado = await service.importar({ gastos: [filaValida(), filaValida(), filaValida()] }, 'tenant-1');

      expect(resultado.creados).toBe(1);
      expect(resultado.errores).toEqual([
        { fila: 3, mensaje: expect.stringContaining('agotada') },
        { fila: 4, mensaje: expect.stringContaining('agotada') },
      ]);
      expect(repository.crearEnTx).toHaveBeenCalledTimes(1);
    });

    it('una fila con error de referencia ANTES del corte por NCF agotada conserva su propio error (bug real en QA: el corte pisaba el error propio de filas que ni siquiera habían llegado a pedir NCF)', async () => {
      repository.siguienteNumeroEnTx.mockRejectedValueOnce(new Error('Secuencia de NCF B11 agotada'));

      const resultado = await service.importar(
        { gastos: [filaValida({ cuentaContable: 'no existe' }), filaValida(), filaValida()] },
        'tenant-1',
      );

      expect(resultado.creados).toBe(0);
      expect(resultado.errores).toEqual([
        { fila: 2, mensaje: expect.stringContaining('no encontrada') },
        { fila: 3, mensaje: expect.stringContaining('agotada') },
        { fila: 4, mensaje: expect.stringContaining('agotada') },
      ]);
    });

    it('sin ninguna secuencia de NCF configurada (P2025 de Prisma): mismo corte temprano que la secuencia agotada', async () => {
      const errorPrisma = new Prisma.PrismaClientKnownRequestError('No NcfAsignado found', { code: 'P2025', clientVersion: 'test' });
      repository.siguienteNumeroEnTx.mockRejectedValue(errorPrisma);

      const resultado = await service.importar({ gastos: [filaValida(), filaValida()] }, 'tenant-1');

      expect(resultado.creados).toBe(0);
      expect(resultado.errores).toHaveLength(2);
      expect(repository.crearEnTx).not.toHaveBeenCalled();
    });

    it('cada fila manda una sola línea con la cantidad/ITBIS de la fila (cantidad/porcentajeItbis por defecto los resuelve crear())', async () => {
      await service.importar({ gastos: [filaValida({ porcentajeItbis: 18, cantidad: 2, concepto: 'Renta de oficina' })] }, 'tenant-1');

      expect(repository.crearEnTx).toHaveBeenCalledWith(
        TX,
        expect.objectContaining({
          monto: 200,
          itbis: 36,
          lineas: [expect.objectContaining({ concepto: 'Renta de oficina', valor: 100, cantidad: 2, porcentajeItbis: 18 })],
        }),
      );
    });
  });
});
