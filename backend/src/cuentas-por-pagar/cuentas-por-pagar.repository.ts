import { Injectable } from '@nestjs/common';
import { EstadoCxP, Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

/**
 * CxP como ledger real (Fase 2/3) — filtra `CuentaPorPagar` directo en vez
 * de recalcular sobre OrdenCompra+Pago (ver el modelo en schema.prisma,
 * nace por RECEPCIÓN, no por orden completa). `OrdenPago` paga la orden
 * completa (Fase 3) — `aplicarPagoFifoEnTx`/`reducirPorDevolucionEnTx`
 * reparten ese monto entre las CuentaPorPagar abiertas de la orden.
 */
const WHERE_PENDIENTE = { estado: { in: [EstadoCxP.ABIERTA, EstadoCxP.PARCIAL] } };

/** Reparte `monto` entre `cuentas` (ya ordenadas, más antigua primero) hasta agotarlo — criterio "open item". Pura — no toca la base. */
function calcularReparto(cuentas: { id: string; saldo: Prisma.Decimal | number }[], monto: number): { id: string; aplicado: number }[] {
  const reparto: { id: string; aplicado: number }[] = [];
  let restante = monto;
  for (const cuenta of cuentas) {
    if (restante <= 0.005) break;
    const saldoActual = Number(cuenta.saldo);
    const aplicado = Math.min(restante, saldoActual);
    reparto.push({ id: cuenta.id, aplicado });
    restante -= aplicado;
  }
  return reparto;
}

@Injectable()
export class CuentasPorPagarRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  /**
   * CuentaPorPagar nace por RECEPCIÓN (ver el modelo), pero `OrdenPago`
   * paga la ORDEN completa — así que el listado agrupa por `OrdenCompra`
   * (mismo criterio/forma que el viejo ledger `Pago`, el botón "Registrar
   * pago" del frontend sigue apuntando al id de la orden sin cambios) y el
   * service suma las CuentaPorPagar abiertas de cada una.
   *
   * Fix 2026-11 (auditoría UX Fase 1): esto SOLO trae cuentas con origen
   * OrdenCompra — una `CuentaPorPagar` de `FacturaProveedor` (gasto a
   * crédito sin orden, Fase 5) nunca aparecía acá aunque sí se sumaba en
   * `listarTodasPendientes()`/resumen. Sin paginar (igual criterio que
   * `listarTodasPendientes` — "pendiente" es por naturaleza un conjunto
   * acotado, se achica solo al pagarse): el merge con
   * `listarFacturasProveedorPendientes` y la paginación final viven en el
   * service, porque son dos orígenes distintos que no se pueden paginar
   * juntos en una sola query de Prisma.
   */
  listarOrdenesPendientes(busqueda?: string) {
    const where: Prisma.OrdenCompraWhereInput = {
      cuentasPorPagar: { some: WHERE_PENDIENTE },
      ...(busqueda
        ? {
            OR: [
              { numero: { contains: busqueda, mode: 'insensitive' as const } },
              { proveedor: { nombre: { contains: busqueda, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };
    return this.db.ordenCompra.findMany({
      where,
      orderBy: { fecha: 'asc' },
      include: {
        proveedor: { select: { nombre: true } },
        cuentasPorPagar: { where: WHERE_PENDIENTE, select: { monto: true, saldo: true, fechaVencimiento: true } },
      },
    });
  }

  /** Contraparte de `listarOrdenesPendientes` para el origen FacturaProveedor — una FacturaProveedor tiene exactamente una CuentaPorPagar, sin agrupar. */
  listarFacturasProveedorPendientes(busqueda?: string) {
    const where: Prisma.CuentaPorPagarWhereInput = {
      ...WHERE_PENDIENTE,
      facturaProveedorId: { not: null },
      ...(busqueda
        ? {
            OR: [
              { facturaProveedor: { ncfProveedor: { contains: busqueda, mode: 'insensitive' as const } } },
              { proveedor: { nombre: { contains: busqueda, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };
    return this.db.cuentaPorPagar.findMany({
      where,
      orderBy: { fecha: 'asc' },
      select: {
        facturaProveedorId: true,
        monto: true,
        saldo: true,
        fecha: true,
        fechaVencimiento: true,
        proveedor: { select: { nombre: true } },
        facturaProveedor: { select: { ncfProveedor: true } },
      },
    });
  }

  /** Sin paginar — usado por el resumen/aging, mismo criterio que antes. */
  listarTodasPendientes() {
    return this.db.cuentaPorPagar.findMany({
      where: WHERE_PENDIENTE,
      select: { id: true, saldo: true, fechaVencimiento: true },
    });
  }

  /**
   * Fase 5 — `data` es una unión discriminada: exactamente `ordenCompraId`
   * (origen Compras, + `recepcionCompraId?` opcional) O `facturaProveedorId`
   * (origen FacturaProveedor, gasto a crédito sin orden de compra), nunca
   * ambos — el CHECK de la migración lo fuerza también a nivel de BD.
   */
  crearEnTx(
    tx: Prisma.TransactionClient,
    data: {
      tenantId: string;
      proveedorId: string;
      terminoPagoId?: string;
      concepto: string;
      monto: number;
      fecha: Date;
      fechaVencimiento: Date;
    } & (
      | {
          ordenCompraId: string;
          // Omitido = CuentaPorPagar "de orden completa" (anticipo a
          // proveedor antes de recibir — ver
          // PagosRepository.registrarCobroOrdenCompra y el comentario del
          // modelo en schema.prisma).
          recepcionCompraId?: string;
          facturaProveedorId?: never;
        }
      | { facturaProveedorId: string; ordenCompraId?: never; recepcionCompraId?: never }
    ),
  ) {
    return tx.cuentaPorPagar.create({ data: { ...data, saldo: data.monto } });
  }

  /**
   * NotaCreditoProveedor (Fase 5) — ajuste financiero puro sobre una
   * FacturaProveedor ya registrada: reduce la deuda ORIGINAL (monto Y
   * saldo), igual criterio que `reducirPorDevolucionEnTx`, pero sobre UNA
   * sola fila (una FacturaProveedor tiene exactamente una CuentaPorPagar,
   * a diferencia de una OrdenCompra que puede tener varias por recepción)
   * — sin reparto FIFO.
   */
  async reducirPorNotaCreditoEnTx(tx: Prisma.TransactionClient, cuentaPorPagarId: string, monto: number) {
    const cuenta = await tx.cuentaPorPagar.findUniqueOrThrow({ where: { id: cuentaPorPagarId }, select: { monto: true, saldo: true } });
    const nuevoSaldo = Number(cuenta.saldo) - monto;
    const nuevoMonto = Number(cuenta.monto) - monto;
    await tx.cuentaPorPagar.update({
      where: { id: cuentaPorPagarId },
      data: { monto: nuevoMonto, saldo: nuevoSaldo, estado: nuevoSaldo <= 0.005 ? 'PAGADA' : 'PARCIAL' },
    });
  }

  /** Anular una FacturaProveedor (solo tipo FACTURA, sin pagos aplicados — ver FacturasProveedorService.anular) — mismo patrón que CuentasPorCobrarRepository.anularPorFacturaEnTx. */
  async anularPorFacturaProveedorEnTx(tx: Prisma.TransactionClient, facturaProveedorId: string) {
    await tx.cuentaPorPagar.updateMany({ where: { facturaProveedorId }, data: { estado: 'ANULADA', saldo: 0 } });
  }

  /** `true` si la orden ya tiene una CuentaPorPagar "de orden completa" (anticipo, `recepcionCompraId: null`) — ver ComprasService.recibir(), que no crea una nueva por recepción en ese caso. */
  async tieneCuentaDeOrdenCompletaEnTx(tx: Prisma.TransactionClient, ordenCompraId: string): Promise<boolean> {
    const existente = await tx.cuentaPorPagar.findFirst({ where: { ordenCompraId, recepcionCompraId: null }, select: { id: true } });
    return !!existente;
  }

  /**
   * Devolución a proveedor (ver ComprasService.devolver) reduce la deuda
   * ORIGINAL, no solo el saldo pendiente — a diferencia de un pago, acá el
   * monto que se debía de entrada estaba de más. Reparte `monto` entre las
   * CuentaPorPagar abiertas de la orden, de la más antigua a la más nueva.
   */
  async reducirPorDevolucionEnTx(tx: Prisma.TransactionClient, ordenCompraId: string, monto: number) {
    const cuentas = await tx.cuentaPorPagar.findMany({
      where: { ordenCompraId, ...WHERE_PENDIENTE },
      orderBy: { fecha: 'asc' },
      select: { id: true, monto: true, saldo: true },
    });
    const reparto = calcularReparto(cuentas, monto);
    for (const { id, aplicado } of reparto) {
      const cuenta = cuentas.find((c) => c.id === id)!;
      const nuevoSaldo = Number(cuenta.saldo) - aplicado;
      const nuevoMonto = Number(cuenta.monto) - aplicado;
      await tx.cuentaPorPagar.update({
        where: { id },
        data: { monto: nuevoMonto, saldo: nuevoSaldo, estado: nuevoSaldo <= 0.005 ? 'PAGADA' : 'PARCIAL' },
      });
    }
  }

  /**
   * Fase 3 — `OrdenPago` paga la OrdenCompra completa (una orden puede
   * tener varias `CuentaPorPagar` abiertas, una por recepción); esto
   * reparte el monto pagado FIFO entre ellas, de la más antigua a la más
   * nueva, dentro de la MISMA transacción que crea el `OrdenPago` (ver
   * `PagosRepository.registrarCobroOrdenCompra`). Devuelve el reparto para
   * que el caller cree una `AplicacionPago` por cada `CuentaPorPagar`
   * efectivamente tocada — un solo pago de orden puede, de forma
   * transparente, terminar aplicado a varias cuentas.
   */
  async aplicarPagoFifoEnTx(tx: Prisma.TransactionClient, ordenCompraId: string, monto: number): Promise<{ id: string; aplicado: number }[]> {
    const cuentas = await tx.cuentaPorPagar.findMany({
      where: { ordenCompraId, ...WHERE_PENDIENTE },
      orderBy: { fecha: 'asc' },
      select: { id: true, saldo: true },
    });
    const reparto = calcularReparto(cuentas, monto);
    for (const { id, aplicado } of reparto) {
      const cuenta = cuentas.find((c) => c.id === id)!;
      const nuevoSaldo = Number(cuenta.saldo) - aplicado;
      await tx.cuentaPorPagar.update({ where: { id }, data: { saldo: nuevoSaldo, estado: nuevoSaldo <= 0.005 ? 'PAGADA' : 'PARCIAL' } });
    }
    return reparto;
  }

  /**
   * Suma de saldos abiertos de una orden — para validar que un pago no
   * exceda lo pendiente (ver PagosService.registrarPagoOrdenCompra). Si la
   * orden todavía no tiene NINGUNA CuentaPorPagar (nunca se recibió ni se
   * le pagó antes — anticipo), el pendiente es `ordenTotal` completo: la
   * fila "de orden completa" recién se crea al registrar el pago (ver
   * PagosRepository.registrarCobroOrdenCompra), no alcanza con solo validar.
   */
  async pendienteDeOrden(ordenCompraId: string, ordenTotal: number): Promise<number> {
    const tieneAlguna = (await this.db.cuentaPorPagar.count({ where: { ordenCompraId } })) > 0;
    if (!tieneAlguna) return ordenTotal;
    return this.saldoPendienteDeOrdenConCliente(this.db, ordenCompraId);
  }

  /** Suma de saldos abiertos de una orden — uso interno (ver pendienteDeOrden/saldoPendienteDeOrdenEnTx). */
  async saldoPendienteDeOrden(ordenCompraId: string): Promise<number> {
    return this.saldoPendienteDeOrdenConCliente(this.db, ordenCompraId);
  }

  /**
   * Misma consulta que `saldoPendienteDeOrden`, pero contra un `tx` ya
   * abierto — necesario para leer el saldo DESPUÉS de que
   * `aplicarPagoFifoEnTx` ya lo descontó en esa misma transacción.
   * `this.db` (fuera de la tx) vería los valores viejos: es OTRA conexión,
   * no ve escrituras todavía no confirmadas de `tx` (ver
   * PagosRepository.registrarCobroOrdenCompra).
   */
  async saldoPendienteDeOrdenEnTx(tx: Prisma.TransactionClient, ordenCompraId: string): Promise<number> {
    return this.saldoPendienteDeOrdenConCliente(tx, ordenCompraId);
  }

  private async saldoPendienteDeOrdenConCliente(cliente: Prisma.TransactionClient, ordenCompraId: string): Promise<number> {
    const cuentas = await cliente.cuentaPorPagar.findMany({ where: { ordenCompraId, ...WHERE_PENDIENTE }, select: { saldo: true } });
    return cuentas.reduce((acc, c) => acc + Number(c.saldo), 0);
  }
}
