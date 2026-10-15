import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { descifrar } from '../common/utils/encriptado.util';
import { DuffelWebhookEvento, extraerIdOrdenDuffel } from './duffel-webhook.util';

const DETALLE_POR_TIPO: Record<string, string> = {
  'order.airline_initiated_change_detected': 'La aerolínea reportó un cambio en el itinerario de este vuelo — revisar los detalles en el panel de Duffel.',
  'order_cancellation.created': 'Se detectó una cancelación de esta reserva en Duffel que no se originó desde esta plataforma — revisar manualmente.',
};

const TIPO_ALERTA: Record<string, string> = {
  'order.airline_initiated_change_detected': 'CAMBIO_ITINERARIO',
  'order_cancellation.created': 'CANCELACION_EXTERNA',
};

/**
 * Corre fuera de un request autenticado (webhook público, sin tenant
 * conocido de antemano) — usa `PrismaService` global con `tenantId`
 * explícito en cada query, nunca `TenantPrismaService` (ver
 * project_tenantprisma_fuera_de_request). Cada tenant tiene su PROPIA
 * cuenta de Duffel: `resolverTenantPorEvento()` identifica a quién
 * pertenece el evento ANTES de que el controller verifique la firma
 * (mismo patrón que `WhatsappBotService.resolverConfigPorNumero`), y
 * `obtenerSecretoWebhook()` entrega el secreto de ESE tenant para esa
 * verificación. Nunca toca `estado` ni el ledger — ver comentario en
 * schema.prisma sobre por qué.
 */
@Injectable()
export class DuffelWebhookService {
  private readonly logger = new Logger(DuffelWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** `null` = ningún TravelReserva coincide con el id de orden del evento — no hay tenant a quien verificarle la firma. */
  async resolverTenantPorEvento(evento: DuffelWebhookEvento): Promise<string | null> {
    const proveedorOrdenId = extraerIdOrdenDuffel(evento);
    if (!proveedorOrdenId) return null;

    const reserva = await this.prisma.travelReserva.findFirst({ where: { proveedorOrdenId }, select: { tenantId: true } });
    return reserva?.tenantId ?? null;
  }

  /** `null` = el tenant no tiene (o ya no tiene) un webhook secret guardado — no se puede verificar nada contra él. */
  async obtenerSecretoWebhook(tenantId: string): Promise<string | null> {
    const config = await this.prisma.travelConfigTenant.findUnique({ where: { tenantId }, select: { duffelWebhookSecretCifrado: true } });
    return config?.duffelWebhookSecretCifrado ? descifrar(config.duffelWebhookSecretCifrado) : null;
  }

  /** Firma ya verificada por el controller contra el secreto de `tenantId` — acá solo aplica la alerta, scopeado a ESE tenant (defensa en profundidad, aunque proveedorOrdenId ya es único por Duffel). */
  async procesarEvento(evento: DuffelWebhookEvento, tenantId: string): Promise<void> {
    const tipo = evento.type;
    if (!tipo || !(tipo in DETALLE_POR_TIPO)) {
      this.logger.warn(`Webhook de Duffel con tipo no manejado: ${tipo ?? '(sin type)'}`);
      return;
    }

    const proveedorOrdenId = extraerIdOrdenDuffel(evento);
    if (!proveedorOrdenId) {
      this.logger.warn(`Webhook de Duffel de tipo "${tipo}" sin un id de orden reconocible: ${JSON.stringify(evento)}`);
      return;
    }

    const resultado = await this.prisma.travelReserva.updateMany({
      where: { proveedorOrdenId, tenantId },
      data: {
        alertaProveedorTipo: TIPO_ALERTA[tipo],
        alertaProveedorDetalle: DETALLE_POR_TIPO[tipo],
        alertaProveedorEn: new Date(),
      },
    });

    if (resultado.count === 0) {
      this.logger.warn(`Webhook de Duffel de tipo "${tipo}" no coincide con ninguna reserva (proveedorOrdenId=${proveedorOrdenId}, tenantId=${tenantId})`);
    }
  }
}
