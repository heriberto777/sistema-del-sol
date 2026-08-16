import { GastosMenoresService } from './gastos-menores.service';
import { GastosMenoresRepository } from './gastos-menores.repository';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';

describe('GastosMenoresService', () => {
  let service: GastosMenoresService;
  let repository: jest.Mocked<GastosMenoresRepository>;
  let tenantPrisma: { client: { $transaction: jest.Mock } };
  let eventBus: jest.Mocked<EventBusService>;

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
    service = new GastosMenoresService(repository, tenantPrisma as unknown as TenantPrismaService, eventBus);
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

  it('listar delega en el repositorio con paginación', async () => {
    repository.listar.mockResolvedValue([[{ id: 'gm1' }], 1] as never);

    const resultado = await service.listar({ pagina: 1, tamanoPagina: 20 } as never);

    expect(resultado).toEqual({ datos: [{ id: 'gm1' }], total: 1, pagina: 1, tamanoPagina: 20 });
  });
});
