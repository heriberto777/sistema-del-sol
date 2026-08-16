import { ReportesService } from './reportes.service';
import { ReportesRepository } from './reportes.repository';
import { RedisService } from '../redis/redis.service';

describe('ReportesService', () => {
  let service: ReportesService;
  let repository: jest.Mocked<ReportesRepository>;
  let redis: jest.Mocked<RedisService>;

  beforeEach(() => {
    repository = {
      ventasDeHoy: jest.fn(),
      stockBajoConteo: jest.fn(),
      ordenesCompraPendientesConteo: jest.fn(),
      facturasEnRango: jest.fn(),
      stockActual: jest.fn(),
      ordenesCompraEnRango: jest.fn(),
    } as unknown as jest.Mocked<ReportesRepository>;
    redis = {
      obtenerJson: jest.fn().mockResolvedValue(null),
      guardarJson: jest.fn(),
      eliminar: jest.fn(),
    } as unknown as jest.Mocked<RedisService>;
    service = new ReportesService(repository, redis);
  });

  describe('dashboard', () => {
    it('combina ventas de hoy, stock bajo y órdenes pendientes en un solo objeto', async () => {
      repository.ventasDeHoy.mockResolvedValue({ total: 1500, cantidad: 3 });
      repository.stockBajoConteo.mockResolvedValue(2);
      repository.ordenesCompraPendientesConteo.mockResolvedValue(1);

      const resultado = await service.dashboard('tenant-1');

      expect(resultado).toEqual({
        ventasHoyTotal: 1500,
        facturasHoyCantidad: 3,
        productosStockBajo: 2,
        ordenesCompraPendientes: 1,
      });
      expect(repository.stockBajoConteo).toHaveBeenCalledWith('tenant-1');
    });

    it('guarda el resultado en Redis con clave por tenant tras calcularlo', async () => {
      repository.ventasDeHoy.mockResolvedValue({ total: 0, cantidad: 0 });
      repository.stockBajoConteo.mockResolvedValue(0);
      repository.ordenesCompraPendientesConteo.mockResolvedValue(0);

      await service.dashboard('tenant-1');

      expect(redis.guardarJson).toHaveBeenCalledWith('reportes:dashboard:tenant-1', expect.any(Object), 30);
    });

    it('si hay un valor en caché, lo devuelve sin consultar el repositorio', async () => {
      const enCache = { ventasHoyTotal: 999, facturasHoyCantidad: 9, productosStockBajo: 0, ordenesCompraPendientes: 0 };
      redis.obtenerJson.mockResolvedValue(enCache);

      const resultado = await service.dashboard('tenant-1');

      expect(resultado).toEqual(enCache);
      expect(repository.ventasDeHoy).not.toHaveBeenCalled();
      expect(repository.stockBajoConteo).not.toHaveBeenCalled();
    });

    it('usa una clave de caché distinta por tenant', async () => {
      repository.ventasDeHoy.mockResolvedValue({ total: 0, cantidad: 0 });
      repository.stockBajoConteo.mockResolvedValue(0);
      repository.ordenesCompraPendientesConteo.mockResolvedValue(0);

      await service.dashboard('tenant-2');

      expect(redis.obtenerJson).toHaveBeenCalledWith('reportes:dashboard:tenant-2');
    });
  });

  describe('reporteVentas', () => {
    it('calcula el resumen (cantidad, subtotal, itbis, total) a partir de las facturas', async () => {
      repository.facturasEnRango.mockResolvedValue([
        { subtotal: 100, itbis: 18, total: 118 },
        { subtotal: 200, itbis: 36, total: 236 },
      ] as never);

      const { resumen } = await service.reporteVentas();

      expect(resumen).toEqual({ cantidad: 2, subtotal: 300, itbis: 54, total: 354 });
    });

    it('usa los últimos 30 días como rango por defecto cuando no se especifica', async () => {
      repository.facturasEnRango.mockResolvedValue([]);

      const { rango } = await service.reporteVentas();

      const diffDias = (rango.hasta.getTime() - rango.desde.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDias).toBeCloseTo(30, 0);
    });

    it('respeta un rango explícito', async () => {
      repository.facturasEnRango.mockResolvedValue([]);

      await service.reporteVentas('2026-01-01', '2026-01-31');

      expect(repository.facturasEnRango).toHaveBeenCalledWith(new Date('2026-01-01'), new Date('2026-01-31'));
    });
  });

  describe('reporteInventario', () => {
    it('cuenta productos en alerta cuando cantidadActual < stockMinimo', async () => {
      repository.stockActual.mockResolvedValue([
        { cantidadActual: 5, stockMinimo: 10 },
        { cantidadActual: 20, stockMinimo: 10 },
        { cantidadActual: 3, stockMinimo: 10 },
      ] as never);

      const { resumen } = await service.reporteInventario('tenant-1');

      expect(resumen).toEqual({ productos: 3, unidades: 28, enAlerta: 2 });
    });

    it('si hay un valor en caché, lo devuelve sin consultar el repositorio', async () => {
      const enCache = { items: [], resumen: { productos: 0, unidades: 0, enAlerta: 0 } };
      redis.obtenerJson.mockResolvedValue(enCache);

      const resultado = await service.reporteInventario('tenant-1');

      expect(resultado).toEqual(enCache);
      expect(repository.stockActual).not.toHaveBeenCalled();
    });
  });

  describe('reporteCompras', () => {
    it('agrupa el conteo de órdenes por estado', async () => {
      repository.ordenesCompraEnRango.mockResolvedValue([
        { total: 100, estado: 'BORRADOR' },
        { total: 200, estado: 'RECIBIDA_TOTAL' },
        { total: 300, estado: 'RECIBIDA_TOTAL' },
      ] as never);

      const { resumen } = await service.reporteCompras();

      expect(resumen).toEqual({
        cantidad: 3,
        total: 600,
        porEstado: { BORRADOR: 1, RECIBIDA_TOTAL: 2 },
      });
    });
  });

  describe('exportarVentas', () => {
    it('genera un xlsx con Content-Type/nombre de archivo correctos', async () => {
      repository.facturasEnRango.mockResolvedValue([
        { ncf: 'B0200000001', fecha: new Date('2026-01-05'), tipoFactura: 'CONTADO', subtotal: 100, itbis: 18, total: 118, cliente: { nombre: 'Cliente X' } },
      ] as never);

      const archivo = await service.exportarVentas(undefined, undefined, 'xlsx');

      expect(archivo.nombreArchivo).toBe('reporte-ventas.xlsx');
      expect(archivo.mimeType).toContain('spreadsheet');
      expect(archivo.buffer.length).toBeGreaterThan(0);
    });

    it('genera un pdf con Content-Type/nombre de archivo correctos', async () => {
      repository.facturasEnRango.mockResolvedValue([
        { ncf: 'B0200000001', fecha: new Date('2026-01-05'), tipoFactura: 'CONTADO', subtotal: 100, itbis: 18, total: 118, cliente: { nombre: 'Cliente X' } },
      ] as never);

      const archivo = await service.exportarVentas(undefined, undefined, 'pdf');

      expect(archivo.nombreArchivo).toBe('reporte-ventas.pdf');
      expect(archivo.mimeType).toBe('application/pdf');
      // Firma binaria de un PDF real ("%PDF-")
      expect(archivo.buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    });
  });
});
