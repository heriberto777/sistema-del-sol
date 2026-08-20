import { BadRequestException } from '@nestjs/common';
import { InventarioRepository } from './inventario.repository';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

describe('InventarioRepository — lotes/FEFO (Fase 5b)', () => {
  let repository: InventarioRepository;
  let tx: any;
  let db: any;

  function lote(overrides: Record<string, unknown> = {}) {
    return {
      id: 'lote-1',
      numeroLote: 'L1',
      fechaVencimiento: new Date('2026-12-01'),
      cantidadActual: 10,
      ...overrides,
    };
  }

  beforeEach(() => {
    tx = {
      stock: { upsert: jest.fn().mockResolvedValue({ id: 's1', cantidadActual: 10, cantidadReservada: 0, stockMinimo: 5 }) },
      lote: {
        findMany: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      movimientoInventario: { create: jest.fn(), findMany: jest.fn() },
      $queryRaw: jest.fn(),
    };
    db = { $transaction: jest.fn((cb: any) => cb(tx)), movimientoInventario: { findMany: jest.fn() } };
    const tenantPrisma = { client: db } as unknown as TenantPrismaService;
    repository = new InventarioRepository(tenantPrisma);
  });

  const baseDescuento = {
    tenantId: 't1',
    productoId: 'p1',
    varianteId: 'v1',
    bodegaId: 'b1',
    cantidad: 8,
    tipo: 'SALIDA' as const,
    userId: 'u1',
    motivo: 'Venta',
    controlaVencimiento: true,
  };

  describe('descontarStockCondicionalEnTx — FEFO automático', () => {
    it('consume un solo lote cuando alcanza, ordenado por vencimiento más próximo', async () => {
      tx.$queryRaw.mockResolvedValue([{ id: 's1', cantidadActual: 2, cantidadReservada: 0, stockMinimo: 5 }]);
      tx.lote.findMany.mockResolvedValue([lote({ id: 'lote-1', cantidadActual: 10 })]);
      tx.lote.update.mockResolvedValue(lote({ id: 'lote-1', cantidadActual: 2 }));

      const resultado = await repository.descontarStockCondicionalEnTx(tx, baseDescuento);

      expect(tx.lote.update).toHaveBeenCalledTimes(1);
      expect(tx.lote.update).toHaveBeenCalledWith({ where: { id: 'lote-1' }, data: { cantidadActual: { decrement: 8 } } });
      expect(tx.movimientoInventario.create).toHaveBeenCalledTimes(1);
      expect(tx.movimientoInventario.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ loteId: 'lote-1', cantidad: 8, direccion: 'SALIDA' }) }),
      );
      expect(resultado!.consumos).toEqual([{ loteId: 'lote-1', numeroLote: 'L1', fechaVencimiento: lote().fechaVencimiento, cantidad: 8 }]);
    });

    it('reparte entre 2 lotes cuando el primero (el que vence antes) no alcanza', async () => {
      tx.$queryRaw.mockResolvedValue([{ id: 's1', cantidadActual: 2, cantidadReservada: 0, stockMinimo: 5 }]);
      tx.lote.findMany.mockResolvedValue([
        lote({ id: 'lote-viejo', numeroLote: 'L1', fechaVencimiento: new Date('2026-09-01'), cantidadActual: 3 }),
        lote({ id: 'lote-nuevo', numeroLote: 'L2', fechaVencimiento: new Date('2026-12-01'), cantidadActual: 10 }),
      ]);
      tx.lote.update
        .mockResolvedValueOnce(lote({ id: 'lote-viejo', cantidadActual: 0 }))
        .mockResolvedValueOnce(lote({ id: 'lote-nuevo', cantidadActual: 5 }));

      const resultado = await repository.descontarStockCondicionalEnTx(tx, baseDescuento);

      expect(tx.lote.update).toHaveBeenCalledTimes(2);
      expect(tx.lote.update).toHaveBeenNthCalledWith(1, { where: { id: 'lote-viejo' }, data: { cantidadActual: { decrement: 3 } } });
      expect(tx.lote.update).toHaveBeenNthCalledWith(2, { where: { id: 'lote-nuevo' }, data: { cantidadActual: { decrement: 5 } } });
      expect(tx.movimientoInventario.create).toHaveBeenCalledTimes(2);
      expect(resultado!.consumos.map((c) => c.cantidad)).toEqual([3, 5]);
    });

    it('rechaza si los lotes vigentes no alcanzan a cubrir la cantidad (aunque Stock agregado sí)', async () => {
      tx.$queryRaw.mockResolvedValue([{ id: 's1', cantidadActual: 2, cantidadReservada: 0, stockMinimo: 5 }]);
      tx.lote.findMany.mockResolvedValue([lote({ id: 'lote-1', cantidadActual: 3 })]);
      tx.lote.update.mockResolvedValue(lote({ id: 'lote-1', cantidadActual: 0 }));

      await expect(repository.descontarStockCondicionalEnTx(tx, baseDescuento)).rejects.toThrow(BadRequestException);
    });

    it('usa el lote explícito (sin FEFO) cuando el caller lo indica — devolución a proveedor', async () => {
      tx.$queryRaw.mockResolvedValue([{ id: 's1', cantidadActual: 2, cantidadReservada: 0, stockMinimo: 5 }]);
      tx.lote.update.mockResolvedValue(lote({ id: 'lote-elegido', cantidadActual: 2 }));

      await repository.descontarStockCondicionalEnTx(tx, { ...baseDescuento, loteId: 'lote-elegido' });

      expect(tx.lote.findMany).not.toHaveBeenCalled();
      expect(tx.lote.update).toHaveBeenCalledWith({ where: { id: 'lote-elegido' }, data: { cantidadActual: { decrement: 8 } } });
    });

    it('sin controlaVencimiento, no toca Lote — comportamiento previo intacto', async () => {
      tx.$queryRaw.mockResolvedValue([{ id: 's1', cantidadActual: 2, cantidadReservada: 0, stockMinimo: 5 }]);

      const resultado = await repository.descontarStockCondicionalEnTx(tx, { ...baseDescuento, controlaVencimiento: false });

      expect(tx.lote.findMany).not.toHaveBeenCalled();
      expect(tx.lote.update).not.toHaveBeenCalled();
      expect(tx.movimientoInventario.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.not.objectContaining({ loteId: expect.anything() }) }));
      expect(resultado!.consumos).toEqual([]);
    });

    it('devuelve null (sin tocar lotes) si el UPDATE condicional de Stock no alcanza', async () => {
      tx.$queryRaw.mockResolvedValue([]);

      const resultado = await repository.descontarStockCondicionalEnTx(tx, baseDescuento);

      expect(resultado).toBeNull();
      expect(tx.lote.findMany).not.toHaveBeenCalled();
    });
  });

  describe('ajustarCantidadEnTx — entrada/ajuste con lotes', () => {
    const baseAjuste = {
      tenantId: 't1',
      productoId: 'p1',
      varianteId: 'v1',
      bodegaId: 'b1',
      delta: 10,
      tipo: 'ENTRADA' as const,
      userId: 'u1',
      motivo: 'Recepción',
      controlaVencimiento: true,
    };

    it('entrada (delta positivo) exige lotesEntrada y hace upsert por lote', async () => {
      tx.lote.upsert.mockResolvedValue(lote({ id: 'lote-nuevo' }));

      await repository.ajustarCantidadEnTx(tx, { ...baseAjuste, lotesEntrada: [{ numeroLote: 'L1', fechaVencimiento: new Date('2026-12-01'), cantidad: 10 }] });

      expect(tx.lote.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId_varianteId_bodegaId_numeroLote: { tenantId: 't1', varianteId: 'v1', bodegaId: 'b1', numeroLote: 'L1' } },
        }),
      );
      expect(tx.movimientoInventario.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ loteId: 'lote-nuevo', cantidad: 10 }) }));
    });

    it('rechaza una entrada sin lotesEntrada cuando el producto controla vencimiento', async () => {
      await expect(repository.ajustarCantidadEnTx(tx, { ...baseAjuste })).rejects.toThrow(BadRequestException);
    });

    it('ajuste negativo exige loteIdSalida explícito (nunca FEFO en una corrección manual)', async () => {
      await expect(repository.ajustarCantidadEnTx(tx, { ...baseAjuste, delta: -3, tipo: 'AJUSTE' })).rejects.toThrow(BadRequestException);
    });

    it('ajuste negativo con loteIdSalida descuenta ese lote puntual', async () => {
      tx.lote.update.mockResolvedValue(lote({ id: 'lote-1', cantidadActual: 7 }));

      await repository.ajustarCantidadEnTx(tx, { ...baseAjuste, delta: -3, tipo: 'AJUSTE', loteIdSalida: 'lote-1' });

      expect(tx.lote.update).toHaveBeenCalledWith({ where: { id: 'lote-1' }, data: { cantidadActual: { decrement: 3 } } });
      expect(tx.movimientoInventario.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ direccion: 'SALIDA', loteId: 'lote-1', cantidad: 3 }) }));
    });
  });

  describe('reconstruirLotesDeVentaEnTx — Nota de Crédito reconstruye sola', () => {
    it('reparte la cantidad devuelta proporcionalmente a como se consumió en la venta original', async () => {
      tx.movimientoInventario.findMany.mockResolvedValue([
        { cantidad: 3, lote: { numeroLote: 'L1', fechaVencimiento: new Date('2026-09-01') } },
        { cantidad: 5, lote: { numeroLote: 'L2', fechaVencimiento: new Date('2026-12-01') } },
      ]);

      const resultado = await repository.reconstruirLotesDeVentaEnTx(tx, 'factura-1', 'v1', 4);

      // Total original 8 (3+5); devolver 4 → 3/8*4=1.5 de L1, 5/8*4=2.5 de L2
      expect(resultado).toEqual([
        { numeroLote: 'L1', fechaVencimiento: new Date('2026-09-01'), cantidad: 1.5 },
        { numeroLote: 'L2', fechaVencimiento: new Date('2026-12-01'), cantidad: 2.5 },
      ]);
    });

    it('rechaza si no encuentra de qué lote salió la venta original', async () => {
      tx.movimientoInventario.findMany.mockResolvedValue([]);

      await expect(repository.reconstruirLotesDeVentaEnTx(tx, 'factura-1', 'v1', 4)).rejects.toThrow(BadRequestException);
    });
  });

  describe('transferir — preserva identidad de lote en destino', () => {
    it('el lote consumido FEFO en origen se acredita con el mismo numeroLote/fechaVencimiento en destino', async () => {
      tx.$queryRaw.mockResolvedValue([{ id: 's1', cantidadActual: 2, cantidadReservada: 0, stockMinimo: 5 }]);
      tx.lote.findMany.mockResolvedValue([lote({ id: 'lote-1', numeroLote: 'L1', fechaVencimiento: new Date('2026-09-01'), cantidadActual: 10 })]);
      tx.lote.update.mockResolvedValue(lote({ id: 'lote-1', cantidadActual: 2 }));
      tx.lote.upsert.mockResolvedValue(lote({ id: 'lote-destino' }));
      tx.stock.upsert.mockResolvedValue({ id: 's2', cantidadActual: 8 });

      await repository.transferir({
        tenantId: 't1',
        productoId: 'p1',
        varianteId: 'v1',
        bodegaOrigenId: 'b1',
        bodegaDestinoId: 'b2',
        cantidad: 8,
        userId: 'u1',
        controlaVencimiento: true,
      });

      expect(tx.lote.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId_varianteId_bodegaId_numeroLote: { tenantId: 't1', varianteId: 'v1', bodegaId: 'b2', numeroLote: 'L1' } },
        }),
      );
    });
  });
});
