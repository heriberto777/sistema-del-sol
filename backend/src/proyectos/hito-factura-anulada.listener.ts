import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { EVENTOS, FacturaCreadaPayload } from '../event-bus/events';

/**
 * Punto 3 del pedido del usuario (2026-09-10) — "Reversar/Anular la
 * factura de un Hito": en vez de duplicar un flujo de anulación dentro de
 * Proyectos, este listener reacciona al `FACTURA_ANULADA` que YA emite
 * `FacturacionService.anular()` (mismo flujo de Facturación de siempre) y
 * reabre el hito para que se pueda volver a facturar sin dejar el
 * `facturaId` colgado de una factura que ya no existe fiscalmente.
 *
 * `FACTURA_ANULADA` reusa el shape de `FacturaCreadaPayload` — no existe
 * un `FacturaAnuladaPayload` propio (confirmado en `event-bus/events.ts`).
 *
 * `PrismaService` global (no `TenantPrismaService`) — corre fuera de un
 * request HTTP, mismo motivo que `PresupuestoProyectoListener`.
 */
@Injectable()
export class HitoFacturaAnuladaListener {
  private readonly logger = new Logger(HitoFacturaAnuladaListener.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(EVENTOS.FACTURA_ANULADA)
  async alAnularFactura(payload: FacturaCreadaPayload) {
    const { count } = await this.prisma.hitoProyecto.updateMany({
      where: { facturaId: payload.facturaId, tenantId: payload.tenantId },
      data: { estado: 'COMPLETADO', facturaId: null },
    });
    if (count > 0) {
      this.logger.log(`Hito reabierto tras anular la factura ${payload.facturaId} (tenant ${payload.tenantId})`);
    }
  }
}
