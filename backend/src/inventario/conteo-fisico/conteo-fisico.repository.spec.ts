import { ConteoFisicoRepository } from './conteo-fisico.repository';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';

describe('ConteoFisicoRepository — buscarResumen/listarLineas (búsqueda y paginación)', () => {
  let repository: ConteoFisicoRepository;
  let db: any;

  function variante(overrides: Record<string, unknown> = {}) {
    return {
      producto: { id: 'p1', nombre: 'Producto A', codigo: 'COD-1' },
      variante: { sku: 'SKU-1', codigoBarras: '7501', valoresAtributo: [] },
      ...overrides,
    };
  }

  function linea(id: string, cantidadTeorica: number, cantidadContada: number | null, overrides: Record<string, unknown> = {}) {
    return { id, cantidadTeorica, cantidadContada, ...variante(overrides) };
  }

  beforeEach(() => {
    db = {
      conteoFisico: { findUniqueOrThrow: jest.fn() },
      lineaConteoFisico: { findMany: jest.fn(), count: jest.fn() },
    };
    const tenantPrisma = { client: db } as unknown as TenantPrismaService;
    repository = new ConteoFisicoRepository(tenantPrisma);
  });

  describe('buscarResumen', () => {
    it('calcula los agregados correctamente sobre una mezcla de líneas', async () => {
      db.conteoFisico.findUniqueOrThrow.mockResolvedValue({ id: 'cf1', numero: 'CF-00001' });
      db.lineaConteoFisico.findMany.mockResolvedValue([
        { cantidadTeorica: 10, cantidadContada: 8 }, // faltante -2
        { cantidadTeorica: 10, cantidadContada: 6 }, // faltante -4
        { cantidadTeorica: 5, cantidadContada: 12 }, // sobrante +7
        { cantidadTeorica: 3, cantidadContada: 3 }, // sin diferencia
        { cantidadTeorica: 20, cantidadContada: null }, // sin contar
      ]);

      const resumen = await repository.buscarResumen('cf1');

      expect(resumen.totalLineas).toBe(5);
      expect(resumen.lineasContadas).toBe(4);
      expect(resumen.lineasConFaltante).toBe(2);
      expect(resumen.lineasConSobrante).toBe(1);
      expect(resumen.lineasSinDiferencia).toBe(1);
      expect(resumen.sumaFaltante).toBe(6); // 2 + 4
      expect(resumen.sumaSobrante).toBe(7);
    });

    it('sin ninguna línea contada, todos los agregados quedan en 0', async () => {
      db.conteoFisico.findUniqueOrThrow.mockResolvedValue({ id: 'cf1' });
      db.lineaConteoFisico.findMany.mockResolvedValue([{ cantidadTeorica: 10, cantidadContada: null }]);

      const resumen = await repository.buscarResumen('cf1');

      expect(resumen).toEqual(
        expect.objectContaining({
          lineasContadas: 0,
          lineasConFaltante: 0,
          lineasConSobrante: 0,
          lineasSinDiferencia: 0,
          sumaFaltante: 0,
          sumaSobrante: 0,
        }),
      );
    });
  });

  describe('listarLineas', () => {
    it('TODAS pagina en SQL directo, sin filtrar por diferencia', async () => {
      db.lineaConteoFisico.findMany.mockResolvedValue([linea('l1', 10, 8)]);
      db.lineaConteoFisico.count.mockResolvedValue(1);

      const [datos, total] = await repository.listarLineas('cf1', { skip: 0, take: 20, filtro: 'TODAS' });

      expect(db.lineaConteoFisico.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { conteoId: 'cf1' }, skip: 0, take: 20 }),
      );
      expect(total).toBe(1);
      expect(datos[0].id).toBe('l1');
    });

    it('CONTADAS filtra cantidadContada IS NOT NULL en SQL', async () => {
      db.lineaConteoFisico.findMany.mockResolvedValue([]);
      db.lineaConteoFisico.count.mockResolvedValue(0);

      await repository.listarLineas('cf1', { skip: 0, take: 20, filtro: 'CONTADAS' });

      expect(db.lineaConteoFisico.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { conteoId: 'cf1', cantidadContada: { not: null } } }),
      );
    });

    it('SIN_CONTAR filtra cantidadContada IS NULL en SQL', async () => {
      db.lineaConteoFisico.findMany.mockResolvedValue([]);
      db.lineaConteoFisico.count.mockResolvedValue(0);

      await repository.listarLineas('cf1', { skip: 0, take: 20, filtro: 'SIN_CONTAR' });

      expect(db.lineaConteoFisico.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { conteoId: 'cf1', cantidadContada: null } }),
      );
    });

    it('CON_FALTANTE filtra en JS (columna contra columna) y pagina el resultado ya filtrado', async () => {
      db.lineaConteoFisico.findMany.mockResolvedValue([
        linea('l1', 10, 8), // faltante
        linea('l2', 10, 10), // sin diferencia, debe excluirse
        linea('l3', 5, 12), // sobrante, debe excluirse
      ]);

      const [datos, total] = await repository.listarLineas('cf1', { skip: 0, take: 20, filtro: 'CON_FALTANTE' });

      expect(db.lineaConteoFisico.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { conteoId: 'cf1', cantidadContada: { not: null } } }),
      );
      expect(db.lineaConteoFisico.count).not.toHaveBeenCalled();
      expect(total).toBe(1);
      expect(datos.map((d: { id: string }) => d.id)).toEqual(['l1']);
    });

    it('CON_SOBRANTE filtra solo las líneas con cantidadContada > cantidadTeorica', async () => {
      db.lineaConteoFisico.findMany.mockResolvedValue([linea('l1', 10, 8), linea('l2', 5, 12)]);

      const [datos] = await repository.listarLineas('cf1', { skip: 0, take: 20, filtro: 'CON_SOBRANTE' });

      expect(datos.map((d: { id: string }) => d.id)).toEqual(['l2']);
    });

    it('SIN_DIFERENCIA filtra solo las líneas con cantidadContada === cantidadTeorica', async () => {
      db.lineaConteoFisico.findMany.mockResolvedValue([linea('l1', 10, 10), linea('l2', 5, 12)]);

      const [datos] = await repository.listarLineas('cf1', { skip: 0, take: 20, filtro: 'SIN_DIFERENCIA' });

      expect(datos.map((d: { id: string }) => d.id)).toEqual(['l1']);
    });

    it('busqueda filtra por nombre/código de producto y sku/códigoBarras de variante', async () => {
      db.lineaConteoFisico.findMany.mockResolvedValue([]);
      db.lineaConteoFisico.count.mockResolvedValue(0);

      await repository.listarLineas('cf1', { skip: 0, take: 20, busqueda: 'yogurt' });

      const where = db.lineaConteoFisico.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([
        { producto: { nombre: { contains: 'yogurt', mode: 'insensitive' } } },
        { producto: { codigo: { contains: 'yogurt', mode: 'insensitive' } } },
        { variante: { sku: { contains: 'yogurt', mode: 'insensitive' } } },
        { variante: { codigoBarras: { contains: 'yogurt', mode: 'insensitive' } } },
      ]);
    });

    it('pagina en JS sobre el resultado ya filtrado por diferencia (skip/take no llegan a Prisma)', async () => {
      db.lineaConteoFisico.findMany.mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => linea(`l${i}`, 10, 5)), // todas con faltante
      );

      const [datos, total] = await repository.listarLineas('cf1', { skip: 2, take: 2, filtro: 'CON_FALTANTE' });

      expect(total).toBe(5);
      expect(datos.map((d: { id: string }) => d.id)).toEqual(['l2', 'l3']);
    });
  });
});
