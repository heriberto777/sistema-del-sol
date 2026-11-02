import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { PagoHistoricoBasico } from '../common/prisma/pago-historico-basico';
import { CuentasPorPagarRepository } from '../cuentas-por-pagar/cuentas-por-pagar.repository';
import { calcularFechaVencimiento } from '../common/fecha/dias-vencido.util';

const EPSILON = 0.005; // tolerancia de redondeo en centavos, igual que PagosService/AsientosContablesService

@Injectable()
export class PagosRepository {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly cuentasPorPagarRepository: CuentasPorPagarRepository,
  ) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  /**
   * CxC como ledger real (Fase 3) — reemplaza `Pago.facturaId`. Todo en una
   * sola transacción: resuelve (o crea, caso degenerado — ver el comentario
   * en `PagosService.registrarPagoFactura`) la `CuentaPorCobrar` de la
   * factura, valida el saldo, descuenta, y crea el `ReciboIngreso` con su
   * única `AplicacionCobro` (cobrar "esta factura" — repartir un cobro
   * entre varias queda para una mejora de interfaz futura, el modelo ya lo
   * admite).
   */
  async registrarCobroFactura(params: {
    tenantId: string;
    facturaId: string;
    clienteId: string;
    facturaFecha: Date;
    facturaPlazoPagoDias: number;
    facturaTotal: number;
    monto: number;
    formaPagoId: string;
    referencia?: string;
    fecha: Date;
    userId: string | null;
  }) {
    return this.db.$transaction(async (tx) => {
      let cuenta = await tx.cuentaPorCobrar.findUnique({ where: { facturaId: params.facturaId } });
      if (!cuenta) {
        cuenta = await tx.cuentaPorCobrar.create({
          data: {
            tenantId: params.tenantId,
            clienteId: params.clienteId,
            facturaId: params.facturaId,
            concepto: `Factura ${params.facturaId}`,
            monto: params.facturaTotal,
            saldo: params.facturaTotal,
            fecha: params.facturaFecha,
            fechaVencimiento: calcularFechaVencimiento(params.facturaFecha, params.facturaPlazoPagoDias),
          },
        });
      }

      const nuevoSaldo = Number(cuenta.saldo) - params.monto;
      await tx.cuentaPorCobrar.update({
        where: { id: cuenta.id },
        data: { saldo: nuevoSaldo, estado: nuevoSaldo <= EPSILON ? 'PAGADA' : 'PARCIAL' },
      });

      const reciboIngreso = await tx.reciboIngreso.create({
        data: {
          tenantId: params.tenantId,
          clienteId: params.clienteId,
          monto: params.monto,
          formaPagoId: params.formaPagoId,
          referencia: params.referencia,
          fecha: params.fecha,
          userId: params.userId,
          aplicaciones: { create: [{ cuentaPorCobrarId: cuenta.id, facturaId: params.facturaId, monto: params.monto }] },
        },
      });

      if (nuevoSaldo <= EPSILON) {
        await tx.factura.update({ where: { id: params.facturaId }, data: { pagada: true, fechaPago: params.fecha } });
      }

      return reciboIngreso;
    });
  }

  /**
   * CxP como ledger real (Fase 3) — reemplaza `Pago.ordenCompraId`. El
   * `OrdenPago` paga la orden completa, pero esta puede tener varias
   * `CuentaPorPagar` abiertas (una por recepción) — `aplicarPagoFifoEnTx`
   * reparte el monto entre ellas, de la más antigua a la más nueva, y acá
   * se crea una `AplicacionPago` por cada una efectivamente tocada. Todo
   * en una sola transacción, igual que `registrarCobroFactura`.
   */
  async registrarCobroOrdenCompra(params: {
    tenantId: string;
    ordenCompraId: string;
    proveedorId: string;
    // Fase 3, bug real (e2e) — ComprasService.registrarPago siempre
    // permitió pagar una orden ANTES de recibirla (anticipo a proveedor).
    // Si la orden todavía no tiene NINGUNA CuentaPorPagar (nunca se
    // recibió ni se le pagó antes), se crea una "de orden completa" acá
    // mismo para que el pago tenga dónde aplicarse — ver el comentario del
    // modelo CuentaPorPagar en schema.prisma.
    ordenFecha: Date;
    ordenTotal: number;
    proveedorPlazoPagoDias: number;
    monto: number;
    retencionIsr: number;
    retencionItbis: number;
    formaPagoId: string;
    referencia?: string;
    fecha: Date;
    userId: string | null;
  }) {
    return this.db.$transaction(async (tx) => {
      const tieneAlgunaCuenta = (await tx.cuentaPorPagar.count({ where: { ordenCompraId: params.ordenCompraId } })) > 0;
      if (!tieneAlgunaCuenta) {
        await this.cuentasPorPagarRepository.crearEnTx(tx, {
          tenantId: params.tenantId,
          proveedorId: params.proveedorId,
          ordenCompraId: params.ordenCompraId,
          concepto: `Orden de compra (anticipo)`,
          monto: params.ordenTotal,
          fecha: params.ordenFecha,
          fechaVencimiento: calcularFechaVencimiento(params.ordenFecha, params.proveedorPlazoPagoDias),
        });
      }

      const reparto = await this.cuentasPorPagarRepository.aplicarPagoFifoEnTx(tx, params.ordenCompraId, params.monto);

      const ordenPago = await tx.ordenPago.create({
        data: {
          tenantId: params.tenantId,
          proveedorId: params.proveedorId,
          monto: params.monto,
          retencionIsr: params.retencionIsr,
          retencionItbis: params.retencionItbis,
          formaPagoId: params.formaPagoId,
          referencia: params.referencia,
          fecha: params.fecha,
          userId: params.userId,
          aplicaciones: { create: reparto.map((r) => ({ cuentaPorPagarId: r.id, monto: r.aplicado })) },
        },
      });

      const saldoRestante = await this.cuentasPorPagarRepository.saldoPendienteDeOrdenEnTx(tx, params.ordenCompraId);
      if (saldoRestante <= EPSILON) {
        await tx.ordenCompra.update({ where: { id: params.ordenCompraId }, data: { pagada: true, fechaPago: params.fecha } });
      }

      return ordenPago;
    });
  }

  /**
   * Fase 5 (CxP) — pago a una FacturaProveedor (gasto a crédito sin orden
   * de compra). Sin FIFO ni creación perezosa, a diferencia de
   * `registrarCobroOrdenCompra`: una FacturaProveedor tiene exactamente UNA
   * CuentaPorPagar, nacida síncrona al crearla (nunca "a secas" como el
   * caso de anticipo de OrdenCompra) — se descuenta directo.
   */
  async registrarCobroFacturaProveedor(params: {
    tenantId: string;
    facturaProveedorId: string;
    proveedorId: string;
    monto: number;
    retencionIsr: number;
    retencionItbis: number;
    formaPagoId: string;
    referencia?: string;
    fecha: Date;
    userId: string | null;
  }) {
    return this.db.$transaction(async (tx) => {
      const cuenta = await tx.cuentaPorPagar.findUniqueOrThrow({ where: { facturaProveedorId: params.facturaProveedorId } });
      const nuevoSaldo = Number(cuenta.saldo) - params.monto;
      await tx.cuentaPorPagar.update({
        where: { id: cuenta.id },
        data: { saldo: nuevoSaldo, estado: nuevoSaldo <= EPSILON ? 'PAGADA' : 'PARCIAL' },
      });

      const ordenPago = await tx.ordenPago.create({
        data: {
          tenantId: params.tenantId,
          proveedorId: params.proveedorId,
          monto: params.monto,
          retencionIsr: params.retencionIsr,
          retencionItbis: params.retencionItbis,
          formaPagoId: params.formaPagoId,
          referencia: params.referencia,
          fecha: params.fecha,
          userId: params.userId,
          aplicaciones: { create: [{ cuentaPorPagarId: cuenta.id, monto: params.monto }] },
        },
      });

      if (nuevoSaldo <= EPSILON) {
        await tx.facturaProveedor.update({ where: { id: params.facturaProveedorId }, data: { pagada: true, fechaPago: params.fecha } });
      }

      return ordenPago;
    });
  }

  /** Pendiente de la factura de proveedor — lee el saldo del ledger directo (ver CuentaPorPagar). */
  async pendienteFacturaProveedor(facturaProveedorId: string): Promise<number> {
    const cuenta = await this.db.cuentaPorPagar.findUniqueOrThrow({ where: { facturaProveedorId }, select: { saldo: true } });
    return Number(cuenta.saldo);
  }

  async listarPorFacturaProveedor(facturaProveedorId: string): Promise<{ pagos: PagoHistoricoBasico[]; totalPagado: number }> {
    const aplicaciones = await this.db.aplicacionPago.findMany({
      where: { cuentaPorPagar: { facturaProveedorId } },
      orderBy: { ordenPago: { fecha: 'desc' } },
      include: { ordenPago: { select: { fecha: true, referencia: true, formaPago: { select: { nombre: true } } } } },
    });
    return {
      pagos: aplicaciones.map((a) => ({
        id: a.id,
        monto: a.monto.toString(),
        fecha: a.ordenPago.fecha.toJSON(),
        referencia: a.ordenPago.referencia,
        formaPago: a.ordenPago.formaPago,
      })),
      totalPagado: aplicaciones.reduce((acc, a) => acc + Number(a.monto), 0),
    };
  }

  /** Pendiente de la factura — lee el saldo del ledger directo, sin sumar pagos (ver CuentaPorCobrar). `null` si la factura nunca tuvo una (CONTADO pagado al crear). */
  async pendienteFactura(facturaId: string): Promise<number | null> {
    const cuenta = await this.db.cuentaPorCobrar.findUnique({ where: { facturaId }, select: { saldo: true } });
    return cuenta ? Number(cuenta.saldo) : null;
  }

  /** Suma de cobros ya aplicados contra una factura — ver FacturacionService.crear (nota de crédito/débito no admite factura con cobro registrado). 0 si nunca tuvo una CuentaPorCobrar. */
  async sumaCobrosFactura(facturaId: string): Promise<number> {
    const { _sum } = await this.db.aplicacionCobro.aggregate({ where: { facturaId }, _sum: { monto: true } });
    return Number(_sum.monto ?? 0);
  }

  /** Versión bulk — evita N+1 al chequear varias facturas a la vez (ver FacturacionService.buscarParaNota). */
  sumaCobrosPorFacturas(facturaIds: string[]) {
    if (!facturaIds.length) return Promise.resolve([]);
    return this.db.aplicacionCobro.groupBy({ by: ['facturaId'], where: { facturaId: { in: facturaIds } }, _sum: { monto: true } });
  }

  async listarPorFactura(facturaId: string): Promise<{ pagos: PagoHistoricoBasico[]; totalPagado: number }> {
    const aplicaciones = await this.db.aplicacionCobro.findMany({
      where: { facturaId },
      orderBy: { reciboIngreso: { fecha: 'desc' } },
      include: { reciboIngreso: { select: { fecha: true, referencia: true, formaPago: { select: { nombre: true } } } } },
    });
    return {
      pagos: aplicaciones.map((a) => ({
        id: a.id,
        monto: a.monto.toString(),
        fecha: a.reciboIngreso.fecha.toJSON(),
        referencia: a.reciboIngreso.referencia,
        formaPago: a.reciboIngreso.formaPago,
      })),
      totalPagado: aplicaciones.reduce((acc, a) => acc + Number(a.monto), 0),
    };
  }

  async listarPorOrdenCompra(ordenCompraId: string): Promise<{ pagos: PagoHistoricoBasico[]; totalPagado: number }> {
    const aplicaciones = await this.db.aplicacionPago.findMany({
      where: { cuentaPorPagar: { ordenCompraId } },
      orderBy: { ordenPago: { fecha: 'desc' } },
      include: { ordenPago: { select: { fecha: true, referencia: true, formaPago: { select: { nombre: true } } } } },
    });
    return {
      pagos: aplicaciones.map((a) => ({
        id: a.id,
        monto: a.monto.toString(),
        fecha: a.ordenPago.fecha.toJSON(),
        referencia: a.ordenPago.referencia,
        formaPago: a.ordenPago.formaPago,
      })),
      totalPagado: aplicaciones.reduce((acc, a) => acc + Number(a.monto), 0),
    };
  }
}
