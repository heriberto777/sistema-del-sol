import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AsientosContablesService } from './asientos-contables.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  EVENTOS,
  CuentaPorCobrarCastigadaPayload,
  CuentaPorCobrarProvisionadaPayload,
  FacturaCreadaPayload,
  FacturaProveedorCreadaPayload,
  GastoMenorCreadoPayload,
  NominaPeriodoPagadoPayload,
  OrdenCompraDevueltaPayload,
  OrdenCompraRecibidaPayload,
  PagoFacturaRegistradoPayload,
  PagoFacturaProveedorRegistradoPayload,
  PagoOrdenCompraRegistradoPayload,
} from '../event-bus/events';

/**
 * Reactor de eventos de negocio -> asientos contables, igual que
 * Notificaciones/Webhooks reaccionan a los mismos eventos sin que
 * Facturación/Compras sepan que la contabilidad existe. Usa
 * PrismaService global (no TenantPrismaService) porque corre fuera de
 * un request HTTP, igual que NotificacionesService.
 */
@Injectable()
export class ContabilidadEventosService {
  private readonly logger = new Logger(ContabilidadEventosService.name);

  constructor(
    private readonly asientosContablesService: AsientosContablesService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent(EVENTOS.FACTURA_CREADA)
  async alFacturarse(payload: FacturaCreadaPayload) {
    try {
      const { ingresosPorCuenta, costosPorCuenta } = await this.agruparVentaPorCuenta(payload.facturaId, payload.tipoFactura);
      await this.asientosContablesService.generarDesdeFactura({
        tenantId: payload.tenantId,
        facturaId: payload.facturaId,
        tipoFactura: payload.tipoFactura,
        itbis: Number(payload.itbis),
        total: Number(payload.total),
        recargos: Number(payload.recargos ?? '0'),
        ingresosPorCuenta,
        costosPorCuenta,
      });
    } catch (error) {
      // Un fallo contable nunca debe tumbar la venta — ya se facturó y
      // se movió inventario; se loguea para corregirlo a mano.
      this.logger.error(`No se pudo generar el asiento de la factura ${payload.facturaId}`, error as Error);
    }
  }

  @OnEvent(EVENTOS.FACTURA_ANULADA)
  async alAnularFactura(payload: FacturaCreadaPayload) {
    try {
      const { ingresosPorCuenta, costosPorCuenta } = await this.agruparVentaPorCuenta(payload.facturaId, payload.tipoFactura);
      await this.asientosContablesService.generarReversaFactura({
        tenantId: payload.tenantId,
        facturaId: payload.facturaId,
        tipoFactura: payload.tipoFactura,
        itbis: Number(payload.itbis),
        total: Number(payload.total),
        recargos: Number(payload.recargos ?? '0'),
        ingresosPorCuenta,
        costosPorCuenta,
      });
    } catch (error) {
      this.logger.error(`No se pudo generar la reversa contable de la factura ${payload.facturaId}`, error as Error);
    }
  }

  /**
   * Motor de costeo + parametrización de cuentas por categoría
   * (docs/PLAN.md, punto 2) — releída de `LineaFactura` (igual patrón que
   * `alRecibirCompra` releyendo `LineaRecepcion`). Agrupa cada línea por
   * `producto.categoria.cuentaIngresoId`/`cuentaCostoId` — `null` cuando
   * el producto no tiene categoría, la categoría no tiene cuenta propia,
   * o la línea es manual/sin producto (ítem B-9): `generarDesdeFactura`
   * resuelve esos `null` a la cuenta genérica fija de siempre. NOTA_CREDITO
   * aplica el mismo signo que ya usa `FacturacionService` para
   * subtotal/itbis/total (sus líneas se guardan en positivo, el signo es
   * a nivel de documento) — así `lineaSegunSigno` invierte Débito/Crédito
   * automáticamente, sin una rama de código aparte. NOTA_DEBITO y líneas
   * de SERVICIO/manuales nunca tienen `costoUnitario` (no aportan a
   * `costosPorCuenta`, sin efecto — mismo comportamiento que antes).
   */
  private async agruparVentaPorCuenta(facturaId: string, tipoFactura: string) {
    const factura = await this.prisma.factura.findUniqueOrThrow({
      where: { id: facturaId },
      select: {
        lineas: {
          select: {
            cantidad: true,
            costoUnitario: true,
            montoTotal: true,
            montoItbis: true,
            centroCostoId: true,
            producto: { select: { categoria: { select: { cuentaIngresoId: true, cuentaCostoId: true } } } },
          },
        },
      },
    });
    const signo = tipoFactura === 'NOTA_CREDITO' ? -1 : 1;
    const ingresosPorCuenta: { cuentaContableId: string | null; centroCostoId: string | null; monto: number }[] = [];
    const costosPorCuenta: { cuentaContableId: string | null; centroCostoId: string | null; monto: number }[] = [];
    for (const l of factura.lineas) {
      const subtotalLinea = (Number(l.montoTotal) - Number(l.montoItbis)) * signo;
      ingresosPorCuenta.push({ cuentaContableId: l.producto?.categoria?.cuentaIngresoId ?? null, centroCostoId: l.centroCostoId, monto: subtotalLinea });
      if (l.costoUnitario != null) {
        const costoLinea = Number(l.cantidad) * Number(l.costoUnitario) * signo;
        costosPorCuenta.push({ cuentaContableId: l.producto?.categoria?.cuentaCostoId ?? null, centroCostoId: l.centroCostoId, monto: costoLinea });
      }
    }
    return { ingresosPorCuenta, costosPorCuenta };
  }

  @OnEvent(EVENTOS.ORDEN_COMPRA_RECIBIDA)
  async alRecibirCompra(payload: OrdenCompraRecibidaPayload) {
    try {
      const recepcion = await this.prisma.recepcionCompra.findUniqueOrThrow({
        where: { id: payload.recepcionId },
        include: { lineas: { include: { producto: true } } },
      });

      const itbis = recepcion.lineas.reduce(
        (acc, l) => acc + Number(l.costoUnitario) * Number(l.cantidadRecibida) * (Number(l.producto.porcentajeItbis) / 100),
        0,
      );
      // Centro de Costo (docs/PLAN.md, punto 3) — heredado de LineaOc a
      // LineaRecepcion al recibir (ver ComprasService.recibir), un grupo
      // por línea; generarDesdeCompra los funde por centro de costo.
      const inventarioPorCentro = recepcion.lineas.map((l) => ({
        centroCostoId: l.centroCostoId,
        monto: Number(l.costoUnitario) * Number(l.cantidadRecibida),
      }));

      await this.asientosContablesService.generarDesdeCompra({
        tenantId: payload.tenantId,
        recepcionId: payload.recepcionId,
        inventarioPorCentro,
        itbis,
      });
    } catch (error) {
      this.logger.error(`No se pudo generar el asiento de la recepción ${payload.recepcionId}`, error as Error);
    }
  }

  @OnEvent(EVENTOS.ORDEN_COMPRA_DEVUELTA)
  async alDevolverCompra(payload: OrdenCompraDevueltaPayload) {
    try {
      await this.asientosContablesService.generarReversaCompra({
        tenantId: payload.tenantId,
        devolucionId: payload.devolucionId,
        monto: Number(payload.monto),
        itbis: Number(payload.itbis),
      });
    } catch (error) {
      this.logger.error(`No se pudo generar la reversa contable de la devolución ${payload.devolucionId}`, error as Error);
    }
  }

  @OnEvent(EVENTOS.PAGO_FACTURA_REGISTRADO)
  async alRegistrarPagoFactura(payload: PagoFacturaRegistradoPayload) {
    try {
      // Mismo criterio que alCrearGastoMenor: el payload solo trae el id,
      // se relee acá con la CuentaBancaria incluida (si se eligió una real
      // al cobrar) para resolver su cuenta contable real.
      const reciboIngreso = await this.prisma.reciboIngreso.findUniqueOrThrow({
        where: { id: payload.pagoId },
        include: { cuentaBancaria: true },
      });
      await this.asientosContablesService.generarDesdePagoFactura({
        tenantId: payload.tenantId,
        pagoId: payload.pagoId,
        monto: Number(payload.monto),
        cuentaCajaId: reciboIngreso.cuentaBancaria?.cuentaContableId,
      });
    } catch (error) {
      this.logger.error(`No se pudo generar el asiento del pago ${payload.pagoId}`, error as Error);
    }
  }

  @OnEvent(EVENTOS.PAGO_ORDEN_COMPRA_REGISTRADO)
  async alRegistrarPagoOrdenCompra(payload: PagoOrdenCompraRegistradoPayload) {
    try {
      const ordenPago = await this.prisma.ordenPago.findUniqueOrThrow({
        where: { id: payload.pagoId },
        include: { cuentaBancaria: true },
      });
      await this.asientosContablesService.generarDesdePagoOrdenCompra({
        tenantId: payload.tenantId,
        pagoId: payload.pagoId,
        monto: Number(payload.monto),
        retencionIsr: Number(payload.retencionIsr),
        retencionItbis: Number(payload.retencionItbis),
        cuentaCajaId: ordenPago.cuentaBancaria?.cuentaContableId,
      });
    } catch (error) {
      this.logger.error(`No se pudo generar el asiento del pago a proveedor ${payload.pagoId}`, error as Error);
    }
  }

  /**
   * Bug real preexistente, encontrado al conectar la cuenta bancaria real
   * (2026-11-23): pagar una FacturaProveedor directa (sin orden de compra
   * de por medio — ver PagosService.registrarPagoFacturaProveedor) emitía
   * este evento, pero nadie lo escuchaba — ningún asiento se generaba. Se
   * reusa generarDesdePagoOrdenCompra tal cual (misma forma contable:
   * Cuentas por Pagar ↔ Caja/Banco, con las mismas retenciones de
   * ISR/ITBIS si aplican).
   */
  @OnEvent(EVENTOS.PAGO_FACTURA_PROVEEDOR_REGISTRADO)
  async alRegistrarPagoFacturaProveedor(payload: PagoFacturaProveedorRegistradoPayload) {
    try {
      const ordenPago = await this.prisma.ordenPago.findUniqueOrThrow({
        where: { id: payload.pagoId },
        include: { cuentaBancaria: true },
      });
      await this.asientosContablesService.generarDesdePagoOrdenCompra({
        tenantId: payload.tenantId,
        pagoId: payload.pagoId,
        monto: Number(payload.monto),
        retencionIsr: Number(payload.retencionIsr),
        retencionItbis: Number(payload.retencionItbis),
        cuentaCajaId: ordenPago.cuentaBancaria?.cuentaContableId,
      });
    } catch (error) {
      this.logger.error(`No se pudo generar el asiento del pago a factura de proveedor ${payload.pagoId}`, error as Error);
    }
  }

  @OnEvent(EVENTOS.CUENTA_POR_COBRAR_PROVISIONADA)
  async alProvisionarIncobrable(payload: CuentaPorCobrarProvisionadaPayload) {
    try {
      await this.asientosContablesService.generarDesdeProvisionIncobrable({
        tenantId: payload.tenantId,
        provisionId: payload.provisionId,
        monto: Number(payload.monto),
      });
    } catch (error) {
      this.logger.error(`No se pudo generar el asiento de provisión de incobrable ${payload.provisionId}`, error as Error);
    }
  }

  @OnEvent(EVENTOS.CUENTA_POR_COBRAR_CASTIGADA)
  async alCastigarIncobrable(payload: CuentaPorCobrarCastigadaPayload) {
    try {
      await this.asientosContablesService.generarDesdeCastigoIncobrable({
        tenantId: payload.tenantId,
        provisionId: payload.provisionId,
        monto: Number(payload.monto),
      });
    } catch (error) {
      this.logger.error(`No se pudo generar el asiento de castigo de incobrable ${payload.provisionId}`, error as Error);
    }
  }

  @OnEvent(EVENTOS.GASTO_MENOR_CREADO)
  async alCrearGastoMenor(payload: GastoMenorCreadoPayload) {
    try {
      const gastoMenor = await this.prisma.gastoMenor.findUniqueOrThrow({
        where: { id: payload.gastoMenorId },
        include: { lineas: true, cuentaBancaria: true },
      });

      await this.asientosContablesService.generarDesdeGastoMenor({
        tenantId: payload.tenantId,
        gastoMenorId: payload.gastoMenorId,
        cuentaBancariaCuentaContableId: gastoMenor.cuentaBancaria.cuentaContableId,
        itbis: Number(gastoMenor.itbis),
        lineas: gastoMenor.lineas.map((l) => ({
          cuentaContableId: l.cuentaContableId,
          monto: Number(l.valor) * Number(l.cantidad),
          centroCostoId: l.centroCostoId ?? undefined,
        })),
      });
    } catch (error) {
      this.logger.error(`No se pudo generar el asiento del gasto menor ${payload.gastoMenorId}`, error as Error);
    }
  }

  /**
   * Fase 5 (CxP) — una NOTA_CREDITO reutiliza el mismo generador que una
   * FACTURA, con los montos negados (ver AsientosContablesService.
   * generarDesdeFacturaProveedor) — así el asiento sale invertido sin
   * duplicar el generador.
   */
  @OnEvent(EVENTOS.FACTURA_PROVEEDOR_CREADA)
  async alCrearFacturaProveedor(payload: FacturaProveedorCreadaPayload) {
    try {
      const facturaProveedor = await this.prisma.facturaProveedor.findUniqueOrThrow({
        where: { id: payload.facturaProveedorId },
        include: { lineas: true },
      });
      const factor = facturaProveedor.tipo === 'NOTA_CREDITO' ? -1 : 1;

      await this.asientosContablesService.generarDesdeFacturaProveedor({
        tenantId: payload.tenantId,
        facturaProveedorId: payload.facturaProveedorId,
        itbis: Number(facturaProveedor.itbis) * factor,
        lineas: facturaProveedor.lineas.map((l) => ({
          cuentaContableId: l.cuentaContableId,
          monto: Number(l.valor) * Number(l.cantidad) * factor,
          centroCostoId: l.centroCostoId ?? undefined,
        })),
      });
    } catch (error) {
      this.logger.error(`No se pudo generar el asiento de la factura de proveedor ${payload.facturaProveedorId}`, error as Error);
    }
  }

  @OnEvent(EVENTOS.NOMINA_PERIODO_PAGADO)
  async alPagarNomina(payload: NominaPeriodoPagadoPayload) {
    try {
      await this.asientosContablesService.generarDesdeNomina({
        tenantId: payload.tenantId,
        periodoId: payload.periodoId,
        totalSalarioBruto: Number(payload.totalSalarioBruto),
        totalSfsEmpleado: Number(payload.totalSfsEmpleado),
        totalAfpEmpleado: Number(payload.totalAfpEmpleado),
        totalIsr: Number(payload.totalIsr),
        totalOtrasDeducciones: Number(payload.totalOtrasDeducciones),
        totalDescuentoAusencias: Number(payload.totalDescuentoAusencias),
        totalHorasExtra: Number(payload.totalHorasExtra ?? '0'),
        totalSalarioNeto: Number(payload.totalSalarioNeto),
        totalSfsEmpleador: Number(payload.totalSfsEmpleador),
        totalAfpEmpleador: Number(payload.totalAfpEmpleador),
        totalInfotep: Number(payload.totalInfotep),
      });
    } catch (error) {
      this.logger.error(`No se pudo generar el asiento del período de nómina ${payload.periodoId}`, error as Error);
    }
  }
}
