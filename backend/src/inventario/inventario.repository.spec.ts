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

describe('InventarioRepository — listarAlertas (ítem E-12)', () => {
  let repository: InventarioRepository;
  let db: any;

  function variante(overrides: Record<string, unknown> = {}) {
    return {
      id: 'v1',
      producto: { id: 'p1', nombre: 'Producto A' },
      valoresAtributo: [{ valorAtributo: { atributo: { nombre: 'Talla' }, valor: 'M' } }],
      ...overrides,
    };
  }

  beforeEach(() => {
    db = {
      stock: { findMany: jest.fn(), count: jest.fn() },
      lote: { findMany: jest.fn(), count: jest.fn() },
      bodega: { findMany: jest.fn() },
    };
    const tenantPrisma = { client: db } as unknown as TenantPrismaService;
    repository = new InventarioRepository(tenantPrisma);
  });

  it('sinStock pagina en SQL directo (cantidadActual <= 0)', async () => {
    db.stock.findMany.mockResolvedValue([{ id: 'st1', cantidadActual: 0, stockMinimo: 5, bodega: { id: 'b1' }, variante: variante() }]);
    db.stock.count.mockResolvedValue(1);

    const [datos, total] = await repository.listarAlertas('sinStock', 't1', undefined, 0, 20);

    expect(db.stock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { variante: { producto: { tenantId: 't1' } }, cantidadActual: { lte: 0 } }, skip: 0, take: 20 }),
    );
    expect(total).toBe(1);
    expect(datos[0]).toEqual(expect.objectContaining({ id: 'st1', producto: { id: 'p1', nombre: 'Producto A' }, valoresAtributo: [{ atributo: 'Talla', valor: 'M' }] }));
  });

  it('stockBajo filtra cantidadActual < stockMinimo en JS y pagina el resultado ya filtrado (columna contra columna, Prisma no lo expresa en where)', async () => {
    db.stock.findMany.mockResolvedValue([
      { id: 'st1', cantidadActual: 3, stockMinimo: 5, bodega: { id: 'b1' }, variante: variante() }, // bajo
      { id: 'st2', cantidadActual: 20, stockMinimo: 5, bodega: { id: 'b1' }, variante: variante() }, // NO bajo, debe excluirse
      { id: 'st3', cantidadActual: 1, stockMinimo: 10, bodega: { id: 'b1' }, variante: variante() }, // bajo
    ]);

    const [datos, total] = await repository.listarAlertas('stockBajo', 't1', undefined, 0, 20);

    expect(db.stock.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ cantidadActual: { gt: 0 } }) }));
    expect(db.stock.count).not.toHaveBeenCalled(); // el total sale de filtrar en JS, no de una segunda query
    expect(total).toBe(2);
    expect(datos.map((d: { id: string }) => d.id)).toEqual(['st1', 'st3']);
  });

  it('stockBajo pagina en JS sobre el resultado ya filtrado (skip/take no se le pasan a Prisma)', async () => {
    db.stock.findMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({ id: `st${i}`, cantidadActual: 1, stockMinimo: 10, bodega: { id: 'b1' }, variante: variante() })),
    );

    const [datos, total] = await repository.listarAlertas('stockBajo', 't1', undefined, 2, 2);

    expect(total).toBe(5);
    expect(datos.map((d: { id: string }) => d.id)).toEqual(['st2', 'st3']);
  });

  it('porVencer filtra Lote por los próximos 7 días y pagina en SQL', async () => {
    db.lote.findMany.mockResolvedValue([{ id: 'l1', numeroLote: 'L1', fechaVencimiento: new Date(), bodega: { id: 'b1' }, variante: variante() }]);
    db.lote.count.mockResolvedValue(1);

    const [datos, total] = await repository.listarAlertas('porVencer', 't1', ['b1'], 0, 20);

    expect(db.lote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 't1', bodegaId: { in: ['b1'] }, cantidadActual: { gt: 0 } }), skip: 0, take: 20 }),
    );
    expect(total).toBe(1);
    expect((datos[0] as { numeroLote: string }).numeroLote).toBe('L1');
  });

  it('vencidos filtra Lote con fechaVencimiento en el pasado', async () => {
    db.lote.findMany.mockResolvedValue([]);
    db.lote.count.mockResolvedValue(0);

    await repository.listarAlertas('vencidos', 't1', undefined, 0, 20);

    const where = db.lote.findMany.mock.calls[0][0].where;
    expect(where.fechaVencimiento.lt).toBeInstanceOf(Date);
    expect(where.fechaVencimiento.gte).toBeUndefined();
  });

  it('bodegaIdsDeSucursal delega en Bodega.findMany filtrado por sucursalId', async () => {
    db.bodega.findMany.mockResolvedValue([{ id: 'b1' }, { id: 'b2' }]);

    const resultado = await repository.bodegaIdsDeSucursal('s1');

    expect(db.bodega.findMany).toHaveBeenCalledWith({ where: { sucursalId: 's1' }, select: { id: true } });
    expect(resultado).toEqual(['b1', 'b2']);
  });
});
