import { Injectable } from '@nestjs/common';
import { ReportesRepository } from './reportes.repository';
import { generarExcel } from './exportadores/excel-exportador';
import { generarPdf } from './exportadores/pdf-exportador';
import { RedisService } from '../redis/redis.service';

const TTL_DASHBOARD_SEGUNDOS = 30;
const TTL_INVENTARIO_SEGUNDOS = 30;

export interface ArchivoGenerado {
  buffer: Buffer;
  nombreArchivo: string;
  mimeType: string;
}

interface DashboardResultado {
  ventasHoyTotal: number;
  facturasHoyCantidad: number;
  productosStockBajo: number;
  ordenesCompraPendientes: number;
}

function rangoPorDefecto(desde?: string, hasta?: string): { desde: Date; hasta: Date } {
  const hastaFecha = hasta ? new Date(hasta) : new Date();
  const desdeFecha = desde ? new Date(desde) : new Date(hastaFecha.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { desde: desdeFecha, hasta: hastaFecha };
}

@Injectable()
export class ReportesService {
  constructor(
    private readonly reportesRepository: ReportesRepository,
    private readonly redis: RedisService,
  ) {}

  /**
   * `sucursalId` (Fase 8d) filtra ventasHoyTotal/facturasHoyCantidad/
   * productosStockBajo — `ordenesCompraPendientes` queda siempre
   * tenant-wide porque `OrdenCompra` no tiene `bodegaId` propio (ver
   * ARCHITECTURE.md).
   */
  async dashboard(tenantId: string, sucursalId?: string): Promise<DashboardResultado> {
    const claveCache = `reportes:dashboard:${tenantId}:${sucursalId ?? 'todas'}`;
    const enCache = await this.redis.obtenerJson<DashboardResultado>(claveCache);
    if (enCache) return enCache;

    const bodegaIds = sucursalId ? await this.reportesRepository.bodegaIdsDeSucursal(sucursalId) : undefined;
    const resultado = await this.calcularDashboard(tenantId, bodegaIds);
    await this.redis.guardarJson(claveCache, resultado, TTL_DASHBOARD_SEGUNDOS);
    return resultado;
  }

  private async calcularDashboard(tenantId: string, bodegaIds?: string[]): Promise<DashboardResultado> {
    const [ventasHoy, productosStockBajo, ordenesCompraPendientes] = await Promise.all([
      this.reportesRepository.ventasDeHoy(bodegaIds),
      this.reportesRepository.stockBajoConteo(tenantId, bodegaIds),
      this.reportesRepository.ordenesCompraPendientesConteo(),
    ]);

    return {
      ventasHoyTotal: ventasHoy.total,
      facturasHoyCantidad: ventasHoy.cantidad,
      productosStockBajo,
      ordenesCompraPendientes,
    };
  }

  async reporteVentas(desde?: string, hasta?: string) {
    const rango = rangoPorDefecto(desde, hasta);
    const facturas = await this.reportesRepository.facturasEnRango(rango.desde, rango.hasta);

    const resumen = facturas.reduce(
      (acc, f) => ({
        cantidad: acc.cantidad + 1,
        subtotal: acc.subtotal + Number(f.subtotal),
        itbis: acc.itbis + Number(f.itbis),
        total: acc.total + Number(f.total),
      }),
      { cantidad: 0, subtotal: 0, itbis: 0, total: 0 },
    );

    return { facturas, resumen, rango };
  }

  async exportarVentas(desde: string | undefined, hasta: string | undefined, formato: 'xlsx' | 'pdf'): Promise<ArchivoGenerado> {
    const { facturas } = await this.reporteVentas(desde, hasta);
    const filas = facturas.map((f) => ({
      ncf: f.ncf ?? '',
      fecha: f.fecha.toLocaleDateString('es-DO'),
      cliente: f.cliente.nombre,
      tipo: f.tipoFactura,
      subtotal: Number(f.subtotal).toFixed(2),
      itbis: Number(f.itbis).toFixed(2),
      total: Number(f.total).toFixed(2),
    }));

    if (formato === 'xlsx') {
      const buffer = await generarExcel(
        'Reporte de ventas',
        [
          { header: 'NCF', key: 'ncf' },
          { header: 'Fecha', key: 'fecha' },
          { header: 'Cliente', key: 'cliente', width: 28 },
          { header: 'Tipo', key: 'tipo' },
          { header: 'Subtotal', key: 'subtotal' },
          { header: 'ITBIS', key: 'itbis' },
          { header: 'Total', key: 'total' },
        ],
        filas,
      );
      return { buffer, nombreArchivo: 'reporte-ventas.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
    }

    const buffer = await generarPdf(
      'Reporte de ventas',
      [
        { header: 'NCF', width: 90 },
        { header: 'Fecha', width: 70 },
        { header: 'Cliente', width: 160 },
        { header: 'Tipo', width: 70 },
        { header: 'Total', width: 80 },
      ],
      filas.map((f) => [f.ncf, f.fecha, f.cliente, f.tipo, f.total]),
    );
    return { buffer, nombreArchivo: 'reporte-ventas.pdf', mimeType: 'application/pdf' };
  }

  async reporteInventario(tenantId: string, sucursalId?: string) {
    const claveCache = `reportes:inventario:${tenantId}:${sucursalId ?? 'todas'}`;
    type ReporteInventarioResultado = Awaited<ReturnType<typeof this.calcularReporteInventario>>;
    const enCache = await this.redis.obtenerJson<ReporteInventarioResultado>(claveCache);
    if (enCache) return enCache;

    const bodegaIds = sucursalId ? await this.reportesRepository.bodegaIdsDeSucursal(sucursalId) : undefined;
    const resultado = await this.calcularReporteInventario(tenantId, bodegaIds);
    await this.redis.guardarJson(claveCache, resultado, TTL_INVENTARIO_SEGUNDOS);
    return resultado;
  }

  private async calcularReporteInventario(tenantId: string, bodegaIds?: string[]) {
    const items = await this.reportesRepository.stockActual(tenantId, bodegaIds);
    const resumen = items.reduce(
      (acc, s) => ({
        productos: acc.productos + 1,
        unidades: acc.unidades + Number(s.cantidadActual),
        enAlerta: acc.enAlerta + (Number(s.cantidadActual) < Number(s.stockMinimo) ? 1 : 0),
      }),
      { productos: 0, unidades: 0, enAlerta: 0 },
    );
    return { items, resumen };
  }

  async exportarInventario(tenantId: string, formato: 'xlsx' | 'pdf', sucursalId?: string): Promise<ArchivoGenerado> {
    const { items } = await this.reporteInventario(tenantId, sucursalId);
    const filas = items.map((s) => ({
      codigo: s.producto.codigo,
      producto: s.producto.nombre,
      bodega: s.bodega.nombre,
      actual: Number(s.cantidadActual).toString(),
      reservado: Number(s.cantidadReservada).toString(),
      minimo: Number(s.stockMinimo).toString(),
      alerta: Number(s.cantidadActual) < Number(s.stockMinimo) ? 'SÍ' : '',
    }));

    if (formato === 'xlsx') {
      const buffer = await generarExcel(
        'Reporte de inventario',
        [
          { header: 'Código', key: 'codigo' },
          { header: 'Producto', key: 'producto', width: 28 },
          { header: 'Bodega', key: 'bodega' },
          { header: 'Actual', key: 'actual' },
          { header: 'Reservado', key: 'reservado' },
          { header: 'Mínimo', key: 'minimo' },
          { header: 'Alerta', key: 'alerta' },
        ],
        filas,
      );
      return { buffer, nombreArchivo: 'reporte-inventario.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
    }

    const buffer = await generarPdf(
      'Reporte de inventario',
      [
        { header: 'Código', width: 70 },
        { header: 'Producto', width: 160 },
        { header: 'Bodega', width: 90 },
        { header: 'Actual', width: 60 },
        { header: 'Mínimo', width: 60 },
        { header: 'Alerta', width: 50 },
      ],
      filas.map((f) => [f.codigo, f.producto, f.bodega, f.actual, f.minimo, f.alerta]),
    );
    return { buffer, nombreArchivo: 'reporte-inventario.pdf', mimeType: 'application/pdf' };
  }

  async reporteCompras(desde?: string, hasta?: string) {
    const rango = rangoPorDefecto(desde, hasta);
    const ordenes = await this.reportesRepository.ordenesCompraEnRango(rango.desde, rango.hasta);

    const resumen = ordenes.reduce(
      (acc, o) => {
        acc.cantidad += 1;
        acc.total += Number(o.total);
        acc.porEstado[o.estado] = (acc.porEstado[o.estado] ?? 0) + 1;
        return acc;
      },
      { cantidad: 0, total: 0, porEstado: {} as Record<string, number> },
    );

    return { ordenes, resumen, rango };
  }

  async exportarCompras(desde: string | undefined, hasta: string | undefined, formato: 'xlsx' | 'pdf'): Promise<ArchivoGenerado> {
    const { ordenes } = await this.reporteCompras(desde, hasta);
    const filas = ordenes.map((o) => ({
      numero: o.numero,
      fecha: o.fecha.toLocaleDateString('es-DO'),
      proveedor: o.proveedor.nombre,
      estado: o.estado,
      total: Number(o.total).toFixed(2),
    }));

    if (formato === 'xlsx') {
      const buffer = await generarExcel(
        'Reporte de compras',
        [
          { header: 'Número', key: 'numero' },
          { header: 'Fecha', key: 'fecha' },
          { header: 'Proveedor', key: 'proveedor', width: 28 },
          { header: 'Estado', key: 'estado' },
          { header: 'Total', key: 'total' },
        ],
        filas,
      );
      return { buffer, nombreArchivo: 'reporte-compras.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
    }

    const buffer = await generarPdf(
      'Reporte de compras',
      [
        { header: 'Número', width: 90 },
        { header: 'Fecha', width: 70 },
        { header: 'Proveedor', width: 160 },
        { header: 'Estado', width: 90 },
        { header: 'Total', width: 80 },
      ],
      filas.map((f) => [f.numero, f.fecha, f.proveedor, f.estado, f.total]),
    );
    return { buffer, nombreArchivo: 'reporte-compras.pdf', mimeType: 'application/pdf' };
  }
}
