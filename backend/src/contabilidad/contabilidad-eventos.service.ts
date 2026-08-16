import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AsientosContablesService } from './asientos-contables.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  EVENTOS,
  FacturaCreadaPayload,
  GastoMenorCreadoPayload,
  NominaPeriodoPagadoPayload,
  OrdenCompraDevueltaPayload,
  OrdenCompraRecibidaPayload,
  PagoFacturaRegistradoPayload,
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
      await this.asientosContablesService.generarDesdeFactura({
        tenantId: payload.tenantId,
        facturaId: payload.facturaId,
        tipoFactura: payload.tipoFactura,
        subtotal: Number(payload.subtotal),
        itbis: Number(payload.itbis),
        total: Number(payload.total),
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
      await this.asientosContablesService.generarReversaFactura({
        tenantId: payload.tenantId,
        facturaId: payload.facturaId,
        tipoFactura: payload.tipoFactura,
        subtotal: Number(payload.subtotal),
        itbis: Number(payload.itbis),
        total: Number(payload.total),
      });
    } catch (error) {
      this.logger.error(`No se pudo generar la reversa contable de la factura ${payload.facturaId}`, error as Error);
    }
  }

  @OnEvent(EVENTOS.ORDEN_COMPRA_RECIBIDA)
  async alRecibirCompra(payload: OrdenCompraRecibidaPayload) {
    try {
      const recepcion = await this.prisma.recepcionCompra.findUniqueOrThrow({
        where: { id: payload.recepcionId },
        include: { lineas: { include: { producto: true } } },
      });

      const monto = recepcion.lineas.reduce((acc, l) => acc + Number(l.costoUnitario) * Number(l.cantidadRecibida), 0);
      const itbis = recepcion.lineas.reduce(
        (acc, l) => acc + Number(l.costoUnitario) * Number(l.cantidadRecibida) * (Number(l.producto.porcentajeItbis) / 100),
        0,
      );

      await this.asientosContablesService.generarDesdeCompra({
        tenantId: payload.tenantId,
        recepcionId: payload.recepcionId,
        monto,
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
      await this.asientosContablesService.generarDesdePagoFactura({
        tenantId: payload.tenantId,
        pagoId: payload.pagoId,
        monto: Number(payload.monto),
      });
    } catch (error) {
      this.logger.error(`No se pudo generar el asiento del pago ${payload.pagoId}`, error as Error);
    }
  }

  @OnEvent(EVENTOS.PAGO_ORDEN_COMPRA_REGISTRADO)
  async alRegistrarPagoOrdenCompra(payload: PagoOrdenCompraRegistradoPayload) {
    try {
      await this.asientosContablesService.generarDesdePagoOrdenCompra({
        tenantId: payload.tenantId,
        pagoId: payload.pagoId,
        monto: Number(payload.monto),
      });
    } catch (error) {
      this.logger.error(`No se pudo generar el asiento del pago a proveedor ${payload.pagoId}`, error as Error);
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
        })),
      });
    } catch (error) {
      this.logger.error(`No se pudo generar el asiento del gasto menor ${payload.gastoMenorId}`, error as Error);
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
