import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ComisionesRepository } from './comisiones.repository';
import { PrismaService } from '../prisma/prisma.service';

function rangoPorDefecto(desde?: string, hasta?: string): { desde: Date; hasta: Date } {
  const hastaFecha = hasta ? new Date(hasta) : new Date();
  const desdeFecha = desde ? new Date(desde) : new Date(hastaFecha.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { desde: desdeFecha, hasta: hastaFecha };
}

interface LineaParaComision {
  id: string;
  // Nullable en el tipo de Prisma (ítem B-9) — nunca null en la práctica
  // acá: el `where` de generarDesdeFactura ya excluye `productoId: null`.
  productoId: string | null;
  cantidad: Prisma.Decimal;
  precioUnitario: Prisma.Decimal;
  descuento: Prisma.Decimal;
  // Nullable en el tipo de Prisma (relación opcional, ítem B-9) — nunca
  // null en la práctica acá: el `where` de generarDesdeFactura ya excluye
  // `productoId: null`.
  producto: { porcentajeComision: Prisma.Decimal | null; montoComisionFijo: Prisma.Decimal | null } | null;
}

@Injectable()
export class ComisionesService {
  constructor(
    private readonly comisionesRepository: ComisionesRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Ítem A-1 — reactor de `factura.creada` (ver ComisionesEventosService).
   * Solo genera comisión si la factura tiene `vendedorEmpleadoId` (ventas
   * de POS con vendedor elegido, ítem F-2) y es una venta nueva
   * (CONTADO/CREDITO) — una Nota de Crédito/Débito ajusta un monto YA
   * facturado, no genera su propia comisión. Cada línea con
   * `pagaComision: false` (Oferta que no paga comisión, ver
   * OfertasService) se excluye directo del `where`.
   */
  async generarDesdeFactura(params: { tenantId: string; facturaId: string; vendedorEmpleadoId: string | null; tipoFactura: string }) {
    if (!params.vendedorEmpleadoId) return;
    if (params.tipoFactura !== 'CONTADO' && params.tipoFactura !== 'CREDITO') return;

    const lineas: LineaParaComision[] = await this.prisma.lineaFactura.findMany({
      // Ítem B-9 — una línea manual (sin productoId) no tiene producto
      // contra el cual resolver porcentajeComision/montoComisionFijo: se
      // excluye acá, no genera ComisionVenta.
      where: { facturaId: params.facturaId, pagaComision: true, productoId: { not: null } },
      select: {
        id: true,
        productoId: true,
        cantidad: true,
        precioUnitario: true,
        descuento: true,
        producto: { select: { porcentajeComision: true, montoComisionFijo: true } },
      },
    });

    const filas = lineas
      .map((linea) => ({ linea, monto: this.calcularMontoComision(linea) }))
      .filter((x) => x.monto > 0)
      .map((x) => ({
        facturaId: params.facturaId,
        lineaFacturaId: x.linea.id,
        // El `where` de arriba ya excluye productoId null.
        productoId: x.linea.productoId as string,
        empleadoId: params.vendedorEmpleadoId as string,
        monto: x.monto,
      }));

    await this.comisionesRepository.crearVarias(params.tenantId, filas);
  }

  /**
   * Sin `porcentajeComision`/`montoComisionFijo` configurado en el
   * producto, la línea simplemente no genera comisión (0) — ver
   * `Producto.porcentajeComision`, mutuamente excluyente con
   * `montoComisionFijo` (validado en `ProductosService`).
   */
  private calcularMontoComision(linea: LineaParaComision): number {
    if (!linea.producto) return 0;
    if (linea.producto.porcentajeComision != null) {
      const montoNeto = Number(linea.cantidad) * Number(linea.precioUnitario) - Number(linea.descuento);
      return montoNeto * (Number(linea.producto.porcentajeComision) / 100);
    }
    if (linea.producto.montoComisionFijo != null) {
      return Number(linea.producto.montoComisionFijo) * Number(linea.cantidad);
    }
    return 0;
  }

  /** Reactor de `factura.anulada` — nunca se borra la fila, se marca `anulada`. */
  anularPorFactura(tenantId: string, facturaId: string) {
    return this.comisionesRepository.anularPorFactura(tenantId, facturaId);
  }

  async reportePorVenta(desdeStr?: string, hastaStr?: string) {
    const { desde, hasta } = rangoPorDefecto(desdeStr, hastaStr);
    const filas = await this.comisionesRepository.listar(desde, hasta);
    const porVenta = new Map<
      string,
      { facturaId: string; ncf: string | null; fecha: Date; cliente: string; empleado: string; montoTotal: number; cantidadLineas: number }
    >();
    for (const fila of filas) {
      const actual = porVenta.get(fila.facturaId) ?? {
        facturaId: fila.facturaId,
        ncf: fila.factura.ncf,
        fecha: fila.factura.fecha,
        cliente: fila.factura.cliente.nombre,
        empleado: fila.empleado.nombre,
        montoTotal: 0,
        cantidadLineas: 0,
      };
      actual.montoTotal += Number(fila.monto);
      actual.cantidadLineas += 1;
      porVenta.set(fila.facturaId, actual);
    }
    return { rango: { desde, hasta }, datos: [...porVenta.values()] };
  }

  async reportePorVendedor(desdeStr?: string, hastaStr?: string) {
    const { desde, hasta } = rangoPorDefecto(desdeStr, hastaStr);
    const filas = await this.comisionesRepository.listar(desde, hasta);
    const porVendedor = new Map<string, { empleadoId: string; empleado: string; montoTotal: number; ventas: Set<string> }>();
    for (const fila of filas) {
      const actual = porVendedor.get(fila.empleadoId) ?? {
        empleadoId: fila.empleadoId,
        empleado: fila.empleado.nombre,
        montoTotal: 0,
        ventas: new Set<string>(),
      };
      actual.montoTotal += Number(fila.monto);
      actual.ventas.add(fila.facturaId);
      porVendedor.set(fila.empleadoId, actual);
    }
    return {
      rango: { desde, hasta },
      datos: [...porVendedor.values()].map((v) => ({
        empleadoId: v.empleadoId,
        empleado: v.empleado,
        montoTotal: v.montoTotal,
        cantidadVentas: v.ventas.size,
      })),
    };
  }

  async reportePorProducto(desdeStr?: string, hastaStr?: string) {
    const { desde, hasta } = rangoPorDefecto(desdeStr, hastaStr);
    const filas = await this.comisionesRepository.listar(desde, hasta);
    const porProducto = new Map<string, { productoId: string; producto: string; montoTotal: number; cantidadLineas: number }>();
    for (const fila of filas) {
      const actual = porProducto.get(fila.productoId) ?? {
        productoId: fila.productoId,
        producto: `${fila.producto.codigo} — ${fila.producto.nombre}`,
        montoTotal: 0,
        cantidadLineas: 0,
      };
      actual.montoTotal += Number(fila.monto);
      actual.cantidadLineas += 1;
      porProducto.set(fila.productoId, actual);
    }
    return { rango: { desde, hasta }, datos: [...porProducto.values()] };
  }
}
