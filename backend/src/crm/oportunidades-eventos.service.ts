import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { EVENTOS, CotizacionRespondidaPayload, CotizacionConvertidaFacturaPayload } from '../event-bus/events';

/**
 * CRM "Cotización conectada" — corre fuera de contexto HTTP (listeners de
 * Event Bus), así que usa `PrismaService` global + `tenantId` explícito,
 * nunca `TenantPrismaService` (request-scoped, ver
 * project_tenantprisma_fuera_de_request en memoria/ARCHITECTURE.md).
 */
@Injectable()
export class OportunidadesEventosService {
  private readonly logger = new Logger(OportunidadesEventosService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * El cliente respondió desde el link público. Si la cotización no está
   * vinculada a ninguna Oportunidad, o esa Oportunidad ya no sigue
   * ABIERTA (se cerró manualmente mientras tanto), no hace nada — este
   * evento solo le importa al CRM, Notificaciones lo escucha aparte para
   * avisarle al vendedor por email sin depender de esto.
   */
  @OnEvent(EVENTOS.COTIZACION_RESPONDIDA)
  async alResponderCotizacion(payload: CotizacionRespondidaPayload) {
    const oportunidad = await this.prisma.oportunidad.findUnique({ where: { cotizacionId: payload.cotizacionId } });
    if (!oportunidad || oportunidad.estado !== 'ABIERTA') return;

    if (payload.decision === 'ACEPTADA') {
      await this.prisma.actividadCrm.createMany({
        data: [
          {
            tenantId: payload.tenantId,
            tipo: 'NOTA',
            descripcion: `El cliente aprobó la cotización ${payload.numero}.`,
            oportunidadId: oportunidad.id,
            usuarioId: payload.vendedorId,
            completada: true,
          },
          {
            tenantId: payload.tenantId,
            tipo: 'TAREA',
            descripcion: `Confirmar y convertir en factura la cotización ${payload.numero} — el cliente ya la aprobó.`,
            oportunidadId: oportunidad.id,
            usuarioId: payload.vendedorId,
            fechaProgramada: new Date(),
          },
        ],
      });
      return;
    }

    await this.prisma.$transaction([
      this.prisma.oportunidad.update({
        where: { id: oportunidad.id },
        data: { estado: 'PERDIDA', motivoPerdida: payload.motivo ?? 'El cliente rechazó la cotización.', fechaCierreReal: new Date() },
      }),
      this.prisma.actividadCrm.create({
        data: {
          tenantId: payload.tenantId,
          tipo: 'NOTA',
          descripcion: `El cliente rechazó la cotización ${payload.numero}${payload.motivo ? `: ${payload.motivo}` : '.'}`,
          oportunidadId: oportunidad.id,
          usuarioId: payload.vendedorId,
          completada: true,
        },
      }),
    ]);
  }

  /** El vendedor confirmó y facturó — recién acá se gana la oportunidad, si había una vinculada. */
  @OnEvent(EVENTOS.COTIZACION_CONVERTIDA_FACTURA)
  async alConvertirseEnFactura(payload: CotizacionConvertidaFacturaPayload) {
    const oportunidad = await this.prisma.oportunidad.findUnique({ where: { cotizacionId: payload.cotizacionId } });
    if (!oportunidad || oportunidad.estado !== 'ABIERTA') return;

    await this.prisma.oportunidad.update({ where: { id: oportunidad.id }, data: { estado: 'GANADA', fechaCierreReal: new Date() } });
    this.logger.log(`Oportunidad ${oportunidad.id} marcada Ganada — su cotización ${payload.cotizacionId} se convirtió en la factura ${payload.facturaId}`);
  }
}
