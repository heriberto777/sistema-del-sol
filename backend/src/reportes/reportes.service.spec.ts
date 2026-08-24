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
      alertasInventarioSegmentadas: jest.fn().mockResolvedValue({ sinStock: 0, stockBajo: 0, porVencer7Dias: 0, vencidos: 0 }),
      facturasEnRango: jest.fn(),
      facturasEnRangoConLineas: jest.fn(),
      stockActual: jest.fn(),
      ordenesCompraEnRango: jest.fn(),
      bodegaIdsDeSucursal: jest.fn(),
    } as unknown as jest.Mocked<ReportesRepository>;
    redis = {
      obtenerJson: jest.fn().mockResolvedValue(null),
      guardarJson: jest.fn(),
      eliminar: jest.fn(),
    } as unknown as jest.Mocked<RedisService>;
    service = new ReportesService(repository, redis);
  });

  describe('dashboard', () => {
    it('combina ventas de hoy, stock bajo, órdenes pendientes y alertas de inventario segmentadas en un solo objeto', async () => {
      repository.ventasDeHoy.mockResolvedValue({ total: 1500, cantidad: 3 });
      repository.stockBajoConteo.mockResolvedValue(2);
      repository.ordenesCompraPendientesConteo.mockResolvedValue(1);
      repository.alertasInventarioSegmentadas.mockResolvedValue({ sinStock: 1, stockBajo: 2, porVencer7Dias: 3, vencidos: 4 });

      const resultado = await service.dashboard('tenant-1');

      expect(resultado).toEqual({
        ventasHoyTotal: 1500,
        facturasHoyCantidad: 3,
        productosStockBajo: 2,
        ordenesCompraPendientes: 1,
        alertasInventario: { sinStock: 1, stockBajo: 2, porVencer7Dias: 3, vencidos: 4 },
      });
      expect(repository.stockBajoConteo).toHaveBeenCalledWith('tenant-1', undefined);
      expect(repository.alertasInventarioSegmentadas).toHaveBeenCalledWith('tenant-1', undefined);
    });

    it('guarda el resultado en Redis con clave por tenant tras calcularlo', async () => {
      repository.ventasDeHoy.mockResolvedValue({ total: 0, cantidad: 0 });
      repository.stockBajoConteo.mockResolvedValue(0);
      repository.ordenesCompraPendientesConteo.mockResolvedValue(0);

      await service.dashboard('tenant-1');

      expect(redis.guardarJson).toHaveBeenCalledWith('reportes:dashboard:tenant-1:todas', expect.any(Object), 30);
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

      expect(redis.obtenerJson).toHaveBeenCalledWith('reportes:dashboard:tenant-2:todas');
    });

    it('con sucursalId, resuelve sus bodegas y filtra ventas/stock bajo — órdenes pendientes queda tenant-wide (Fase 8d)', async () => {
      repository.bodegaIdsDeSucursal.mockResolvedValue(['b1', 'b2']);
      repository.ventasDeHoy.mockResolvedValue({ total: 500, cantidad: 1 });
      repository.stockBajoConteo.mockResolvedValue(1);
      repository.ordenesCompraPendientesConteo.mockResolvedValue(4);

      await service.dashboard('tenant-1', 'sucursal-1');

      expect(repository.bodegaIdsDeSucursal).toHaveBeenCalledWith('sucursal-1');
      expect(repository.ventasDeHoy).toHaveBeenCalledWith(['b1', 'b2']);
      expect(repository.stockBajoConteo).toHaveBeenCalledWith('tenant-1', ['b1', 'b2']);
      expect(redis.guardarJson).toHaveBeenCalledWith('reportes:dashboard:tenant-1:sucursal-1', expect.any(Object), 30);
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

    it('con sucursalId, resuelve sus bodegas y filtra el stock (Fase 8d)', async () => {
      repository.bodegaIdsDeSucursal.mockResolvedValue(['b1']);
      repository.stockActual.mockResolvedValue([{ cantidadActual: 5, stockMinimo: 10 }] as never);

      await service.reporteInventario('tenant-1', 'sucursal-1');

      expect(repository.bodegaIdsDeSucursal).toHaveBeenCalledWith('sucursal-1');
      expect(repository.stockActual).toHaveBeenCalledWith('tenant-1', ['b1']);
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

  describe('reporteVentasAgrupado (plan de integración Cuadre, ítem J-2)', () => {
    const facturaBase = (overrides: Record<string, unknown> = {}) => ({
      clienteId: 'cli-1',
      cliente: { id: 'cli-1', nombre: 'Cliente A' },
      vendedorEmpleadoId: 'emp-1',
      vendedorEmpleado: { id: 'emp-1', nombre: 'Juan Vendedor' },
      formaPagoId: 'fp-1',
      formaPago: { id: 'fp-1', nombre: 'Efectivo' },
      subtotal: 100,
      itbis: 18,
      total: 118,
      lineas: [
        {
          productoId: 'prod-1',
          producto: { id: 'prod-1', nombre: 'Producto A', categoria: { id: 'cat-1', nombre: 'Categoría A' } },
          variante: { codigoBarras: '7501234567890', precios: [{ costo: 50 }] },
          cantidad: 2,
          precioUnitario: 50,
          descuento: 0,
          montoItbis: 18,
          montoTotal: 118,
        },
      ],
      ...overrides,
    });

    it('agrupa por cliente sumando cantidad/subtotal/itbis/total', async () => {
      repository.facturasEnRangoConLineas.mockResolvedValue([facturaBase(), facturaBase()] as never);

      const resultado = await service.reporteVentasAgrupado(undefined, undefined, 'cliente');

      expect(resultado.filas).toEqual([{ etiqueta: 'Cliente A', cantidad: 2, subtotal: 200, itbis: 36, total: 236 }]);
    });

    it('agrupa por vendedor, usando "Sin vendedor" cuando la venta no tiene uno', async () => {
      repository.facturasEnRangoConLineas.mockResolvedValue([facturaBase({ vendedorEmpleadoId: null, vendedorEmpleado: null })] as never);

      const resultado = await service.reporteVentasAgrupado(undefined, undefined, 'vendedor');

      expect(resultado.filas[0]).toEqual(expect.objectContaining({ etiqueta: 'Sin vendedor', cantidad: 1 }));
    });

    it('agrupa por producto sumando a nivel de LÍNEA, no de factura', async () => {
      repository.facturasEnRangoConLineas.mockResolvedValue([facturaBase()] as never);

      const resultado = await service.reporteVentasAgrupado(undefined, undefined, 'producto');

      // subtotal de línea = 2*50 - 0 = 100 (no el subtotal de la factura completa)
      expect(resultado.filas[0]).toEqual({ etiqueta: 'Producto A', cantidad: 1, subtotal: 100, itbis: 18, total: 118 });
    });

    it('agrupa por categoría usando la categoría del producto de la línea', async () => {
      repository.facturasEnRangoConLineas.mockResolvedValue([facturaBase()] as never);

      const resultado = await service.reporteVentasAgrupado(undefined, undefined, 'categoria');

      expect(resultado.filas[0]).toEqual(expect.objectContaining({ etiqueta: 'Categoría A' }));
    });

    it('agrupa por código alterno y descarta líneas de variantes sin código de barras', async () => {
      repository.facturasEnRangoConLineas.mockResolvedValue([
        facturaBase(),
        facturaBase({ lineas: [{ ...facturaBase().lineas[0], variante: { codigoBarras: null, precios: [{ costo: 50 }] } }] }),
      ] as never);

      const resultado = await service.reporteVentasAgrupado(undefined, undefined, 'codigoAlterno');

      expect(resultado.filas).toHaveLength(1);
      expect(resultado.filas[0].etiqueta).toBe('7501234567890');
    });

    it('ordena las filas de mayor a menor total', async () => {
      repository.facturasEnRangoConLineas.mockResolvedValue([
        facturaBase({ clienteId: 'cli-chico', cliente: { id: 'cli-chico', nombre: 'Chico' }, total: 50 }),
        facturaBase({ clienteId: 'cli-grande', cliente: { id: 'cli-grande', nombre: 'Grande' }, total: 500 }),
      ] as never);

      const resultado = await service.reporteVentasAgrupado(undefined, undefined, 'cliente');

      expect(resultado.filas.map((f) => f.etiqueta)).toEqual(['Grande', 'Chico']);
    });
  });

  describe('reporteRentabilidad (plan de integración Cuadre, ítem J-2)', () => {
    it('calcula margen bruto y % usando el costo vigente de la variante', async () => {
      repository.facturasEnRangoConLineas.mockResolvedValue([
        {
          lineas: [
            {
              productoId: 'prod-1',
              producto: { id: 'prod-1', nombre: 'Producto A' },
              variante: { precios: [{ costo: 60 }] },
              cantidad: 2,
              precioUnitario: 100,
              descuento: 0,
            },
          ],
        },
      ] as never);

      const resultado = await service.reporteRentabilidad(undefined, undefined);

      // ventaNeta = 2*100 = 200; costo = 2*60 = 120; margen = 80; margenPct = 40%
      expect(resultado.filas[0]).toEqual(
        expect.objectContaining({ producto: 'Producto A', cantidad: 2, ventasNetas: 200, costo: 120, margen: 80, margenPct: 40 }),
      );
    });

    it('costo 0 si la variante no tiene un precio vigente en la lista GENERAL', async () => {
      repository.facturasEnRangoConLineas.mockResolvedValue([
        {
          lineas: [
            {
              productoId: 'prod-1',
              producto: { id: 'prod-1', nombre: 'Producto A' },
              variante: { precios: [] },
              cantidad: 1,
              precioUnitario: 100,
              descuento: 0,
            },
          ],
        },
      ] as never);

      const resultado = await service.reporteRentabilidad(undefined, undefined);

      expect(resultado.filas[0]).toEqual(expect.objectContaining({ costo: 0, margen: 100 }));
    });
  });
});
