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
  alertasInventario: { sinStock: number; stockBajo: number; porVencer7Dias: number; vencidos: number };
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
    const [ventasHoy, productosStockBajo, ordenesCompraPendientes, alertasInventario] = await Promise.all([
      this.reportesRepository.ventasDeHoy(bodegaIds),
      this.reportesRepository.stockBajoConteo(tenantId, bodegaIds),
      this.reportesRepository.ordenesCompraPendientesConteo(),
      this.reportesRepository.alertasInventarioSegmentadas(tenantId, bodegaIds),
    ]);

    return {
      ventasHoyTotal: ventasHoy.total,
      facturasHoyCantidad: ventasHoy.cantidad,
      productosStockBajo,
      ordenesCompraPendientes,
      alertasInventario,
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

  /**
   * Catálogo de reportes ampliado (plan de integración Cuadre, ítem
   * J-2) — ventas agrupadas por una de 6 dimensiones (cubre "por
   * Cliente/Categoría/Producto/Código Alterno/Tipo de Pago/Vendedor" de
   * la comparación original; "Resumida/Detallada/por Fecha" ya existían
   * en `reporteVentas`, y "Comisiones" queda fuera — ver ítem A-1).
   * `categoria`/`producto`/`codigoAlterno` agregan por LÍNEA (una
   * factura con productos de 2 categorías cuenta en ambas); el resto
   * agrega por FACTURA completa. Sin paginar — mismo criterio que
   * Kardex/libro mayor: se trae el rango completo y se agrega en Node.
   */
  async reporteVentasAgrupado(desde: string | undefined, hasta: string | undefined, dimension: string) {
    const rango = rangoPorDefecto(desde, hasta);
    const facturas = await this.reportesRepository.facturasEnRangoConLineas(rango.desde, rango.hasta);

    const acumulado = new Map<string, { etiqueta: string; cantidad: number; subtotal: number; itbis: number; total: number }>();
    const sumar = (clave: string, etiqueta: string, montos: { subtotal: number; itbis: number; total: number }) => {
      const actual = acumulado.get(clave) ?? { etiqueta, cantidad: 0, subtotal: 0, itbis: 0, total: 0 };
      actual.cantidad += 1;
      actual.subtotal += montos.subtotal;
      actual.itbis += montos.itbis;
      actual.total += montos.total;
      acumulado.set(clave, actual);
    };

    for (const f of facturas) {
      const montosFactura = { subtotal: Number(f.subtotal), itbis: Number(f.itbis), total: Number(f.total) };
      if (dimension === 'cliente') {
        sumar(f.clienteId, f.cliente.nombre, montosFactura);
      } else if (dimension === 'vendedor') {
        sumar(f.vendedorEmpleadoId ?? 'sin-vendedor', f.vendedorEmpleado?.nombre ?? 'Sin vendedor', montosFactura);
      } else if (dimension === 'formaPago') {
        // La "principal" ya resuelta en la factura (mayor monto entre los pagos) — un
        // pago dividido no se desglosa acá, mismo criterio que Factura.formaPagoId.
        sumar(f.formaPagoId ?? 'sin-forma-pago', f.formaPago?.nombre ?? 'Sin forma de pago', montosFactura);
      } else {
        for (const l of f.lineas) {
          // Ítem B-9 — una línea manual no tiene producto/variante del
          // catálogo contra qué agrupar; se excluye de estas 3
          // dimensiones (no hay ítem equivalente para "sin categoría").
          if (!l.productoId) continue;
          const montosLinea = {
            subtotal: Number(l.cantidad) * Number(l.precioUnitario) - Number(l.descuento),
            itbis: Number(l.montoItbis),
            total: Number(l.montoTotal),
          };
          if (dimension === 'producto') {
            sumar(l.productoId, l.producto!.nombre, montosLinea);
          } else if (dimension === 'categoria') {
            sumar(l.producto!.categoria?.id ?? 'sin-categoria', l.producto!.categoria?.nombre ?? 'Sin categoría', montosLinea);
          } else if (dimension === 'codigoAlterno') {
            if (!l.variante!.codigoBarras) continue;
            sumar(l.variante!.codigoBarras, l.variante!.codigoBarras, montosLinea);
          }
        }
      }
    }

    const filas = [...acumulado.values()].sort((a, b) => b.total - a.total);
    return { filas, rango };
  }

  /**
   * Rentabilidad por producto (ítem J-2) — margen = ventas netas (sin
   * ITBIS) menos costo vigente HOY de la variante (lista "GENERAL"). No
   * es el costo real al momento de cada venta (`LineaFactura` no
   * snapshotea costo, solo precio de venta) — limitación conocida,
   * documentada, igual criterio que otros reportes de este proyecto que
   * usan el dato vigente en vez de reconstruir historial.
   */
  async reporteRentabilidad(desde?: string, hasta?: string) {
    const rango = rangoPorDefecto(desde, hasta);
    const facturas = await this.reportesRepository.facturasEnRangoConLineas(rango.desde, rango.hasta);

    const acumulado = new Map<string, { producto: string; cantidad: number; ventasNetas: number; costo: number }>();
    for (const f of facturas) {
      for (const l of f.lineas) {
        // Ítem B-9 — una línea manual no tiene costo real (variante) contra
        // qué comparar; se excluye del margen (limitación documentada, no
        // se inventa un costo ficticio).
        if (!l.productoId) continue;
        const cantidad = Number(l.cantidad);
        const ventaNeta = cantidad * Number(l.precioUnitario) - Number(l.descuento);
        const costoUnitario = Number(l.variante!.precios[0]?.costo ?? 0);
        const actual = acumulado.get(l.productoId) ?? { producto: l.producto!.nombre, cantidad: 0, ventasNetas: 0, costo: 0 };
        actual.cantidad += cantidad;
        actual.ventasNetas += ventaNeta;
        actual.costo += cantidad * costoUnitario;
        acumulado.set(l.productoId, actual);
      }
    }

    const filas = [...acumulado.entries()]
      .map(([productoId, v]) => ({
        productoId,
        producto: v.producto,
        cantidad: v.cantidad,
        ventasNetas: v.ventasNetas,
        costo: v.costo,
        margen: v.ventasNetas - v.costo,
        margenPct: v.ventasNetas > 0 ? ((v.ventasNetas - v.costo) / v.ventasNetas) * 100 : 0,
      }))
      .sort((a, b) => b.margen - a.margen);

    return { filas, rango };
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
