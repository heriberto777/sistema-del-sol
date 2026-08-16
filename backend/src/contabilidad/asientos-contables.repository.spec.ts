import { AsientosContablesRepository } from './asientos-contables.repository';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

/**
 * Prueba el reintento ante P2002 de forma determinística, en vez de
 * depender de que una carrera real contra Postgres se manifieste en un
 * e2e (los tests de concurrencia en app.e2e-spec.ts SÍ ejercitan esto
 * contra la base real, pero si la colisión no ocurre en esa corrida
 * concreta —depende del timing exacto de los listeners fire-and-forget—
 * no prueban nada; este spec fuerza el conflicto siempre).
 */
function errorP2002() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`tenantId`,`numero`)', {
    code: 'P2002',
    clientVersion: '5.22.0',
  });
}

describe('AsientosContablesRepository — reintento ante colisión de "numero"', () => {
  let repository: AsientosContablesRepository;
  let tenantPrisma: { client: { $transaction: jest.Mock } };
  let prisma: { $transaction: jest.Mock };

  const params = { tenantId: 't1', concepto: 'Test', origen: 'MANUAL' as const, lineas: [] };

  beforeEach(() => {
    tenantPrisma = { client: { $transaction: jest.fn() } };
    prisma = { $transaction: jest.fn() };
    repository = new AsientosContablesRepository(
      tenantPrisma as unknown as TenantPrismaService,
      prisma as unknown as PrismaService,
    );
  });

  it('crear() reintenta ante P2002 y devuelve el resultado del intento exitoso', async () => {
    tenantPrisma.client.$transaction.mockRejectedValueOnce(errorP2002()).mockResolvedValueOnce({ id: 'a1', numero: 2 });

    const resultado = await repository.crear(params);

    expect(resultado).toEqual({ id: 'a1', numero: 2 });
    expect(tenantPrisma.client.$transaction).toHaveBeenCalledTimes(2);
  });

  it('crear() NO reintenta ante un error que no es P2002 (falla real, no una colisión de numero)', async () => {
    tenantPrisma.client.$transaction.mockRejectedValue(new Error('otro error'));

    await expect(repository.crear(params)).rejects.toThrow('otro error');
    expect(tenantPrisma.client.$transaction).toHaveBeenCalledTimes(1);
  });

  it('crear() se rinde y propaga el error tras agotar los intentos si sigue colisionando', async () => {
    tenantPrisma.client.$transaction.mockRejectedValue(errorP2002());

    await expect(repository.crear(params)).rejects.toThrow(Prisma.PrismaClientKnownRequestError);
    expect(tenantPrisma.client.$transaction).toHaveBeenCalledTimes(5);
  });

  it('crearGlobal() usa el cliente global (PrismaService) y también reintenta ante P2002', async () => {
    prisma.$transaction.mockRejectedValueOnce(errorP2002()).mockResolvedValueOnce({ id: 'a1', numero: 3 });

    const resultado = await repository.crearGlobal(params);

    expect(resultado).toEqual({ id: 'a1', numero: 3 });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(tenantPrisma.client.$transaction).not.toHaveBeenCalled();
  });
});
