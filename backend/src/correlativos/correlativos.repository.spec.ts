import { CorrelativosRepository } from './correlativos.repository';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

describe('CorrelativosRepository', () => {
  let repository: CorrelativosRepository;
  let tx: { correlativo: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock } };
  let db: { correlativo: typeof tx.correlativo & { findMany: jest.Mock }; $transaction: jest.Mock };

  beforeEach(() => {
    tx = { correlativo: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() } };
    db = {
      correlativo: { ...tx.correlativo, findMany: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(tx)),
    };
    const tenantPrisma = { client: db } as unknown as TenantPrismaService;
    repository = new CorrelativosRepository(tenantPrisma);
  });

  describe('siguienteEnTx', () => {
    it('incrementa atómicamente y devuelve el número ANTES de incrementar, con prefijo y padding', async () => {
      tx.correlativo.findFirst.mockResolvedValue({ id: 'c1', prefijo: 'COT-', siguienteNumero: 7, digitos: 5 });
      tx.correlativo.update.mockResolvedValue({ id: 'c1', prefijo: 'COT-', siguienteNumero: 8, digitos: 5 });

      const numero = await repository.siguienteEnTx(tx as never, 't1', 'COTIZACION');

      expect(tx.correlativo.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { siguienteNumero: { increment: 1 } } });
      expect(numero).toBe('COT-00007');
    });

    it('si el tenant no tiene fila para el tipo, la crea con defaults antes de consumirla', async () => {
      tx.correlativo.findFirst.mockResolvedValue(null);
      tx.correlativo.create.mockResolvedValue({ id: 'c-nueva', prefijo: '', siguienteNumero: 1, digitos: 5 });
      tx.correlativo.update.mockResolvedValue({ id: 'c-nueva', prefijo: '', siguienteNumero: 2, digitos: 5 });

      const numero = await repository.siguienteEnTx(tx as never, 't1', 'REMISION');

      expect(tx.correlativo.create).toHaveBeenCalledWith({
        data: { tenantId: 't1', tipo: 'REMISION', prefijo: '', digitos: 5, siguienteNumero: 1 },
      });
      expect(numero).toBe('00001');
    });
  });

  describe('siguiente', () => {
    it('abre su propia transacción y delega en siguienteEnTx', async () => {
      tx.correlativo.findFirst.mockResolvedValue({ id: 'c1', prefijo: 'PROD-', siguienteNumero: 3, digitos: 4 });
      tx.correlativo.update.mockResolvedValue({ id: 'c1', prefijo: 'PROD-', siguienteNumero: 4, digitos: 4 });

      const numero = await repository.siguiente('t1', 'PRODUCTO');

      expect(db.$transaction).toHaveBeenCalled();
      expect(numero).toBe('PROD-0003');
    });
  });

  describe('listar', () => {
    it('devuelve las 7 filas (una por TipoCorrelativo), rellenando con defaults las que el tenant no tenga', async () => {
      db.correlativo.findMany.mockResolvedValue([{ id: 'c1', tipo: 'COTIZACION', prefijo: 'COT-', siguienteNumero: 5, digitos: 5 }]);

      const filas = await repository.listar();

      expect(filas).toHaveLength(7);
      expect(filas.find((f) => f.tipo === 'COTIZACION')).toEqual({ id: 'c1', tipo: 'COTIZACION', prefijo: 'COT-', siguienteNumero: 5, digitos: 5 });
      expect(filas.find((f) => f.tipo === 'PRODUCTO')).toEqual({ id: null, tipo: 'PRODUCTO', prefijo: '', digitos: 5, siguienteNumero: 1 });
    });
  });

  describe('actualizar', () => {
    it('actualiza prefijo/siguienteNumero/dígitos de una fila existente', async () => {
      db.correlativo.findFirst.mockResolvedValue({ id: 'c1' });
      db.correlativo.update.mockResolvedValue({ id: 'c1', prefijo: 'NEW-', siguienteNumero: 100, digitos: 6 });

      await repository.actualizar('t1', 'CAJA', { prefijo: 'NEW-', siguienteNumero: 100, digitos: 6 });

      expect(db.correlativo.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { prefijo: 'NEW-', siguienteNumero: 100, digitos: 6 },
      });
    });

    it('crea la fila con defaults primero si el tenant todavía no la tiene', async () => {
      db.correlativo.findFirst.mockResolvedValue(null);
      db.correlativo.create.mockResolvedValue({ id: 'c-nueva' });
      db.correlativo.update.mockResolvedValue({ id: 'c-nueva', prefijo: 'X-' });

      await repository.actualizar('t1', 'ORDEN_COMPRA', { prefijo: 'X-' });

      expect(db.correlativo.create).toHaveBeenCalledWith({
        data: { tenantId: 't1', tipo: 'ORDEN_COMPRA', prefijo: '', digitos: 5, siguienteNumero: 1 },
      });
      expect(db.correlativo.update).toHaveBeenCalledWith({ where: { id: 'c-nueva' }, data: { prefijo: 'X-' } });
    });
  });
});
