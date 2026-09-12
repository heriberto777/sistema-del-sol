import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Envelope real de un webhook de Duffel — la doc pública confirma el
 * esquema de firma (ver duffel-webhook.util.ts) y los nombres de evento,
 * pero NO se pudo confirmar en vivo la forma exacta del envelope (no hay
 * forma de recibir un webhook real sin una URL pública desde este
 * entorno de desarrollo). Se acepta un cuerpo laxo, con varias rutas
 * posibles para encontrar el id de la orden, mismo criterio "best-effort"
 * que AlanubeWebhookController — un evento con forma inesperada se loguea
 * y se responde 200 igual (nunca reintentos innecesarios del proveedor).
 */
interface DuffelWebhookEvento {
  type?: string;
  object_id?: string;
  data?: {
    id?: string;
    order_id?: string;
    object?: { id?: string; order_id?: string };
    [key: string]: unknown;
  };
}

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
 * conocido) — usa PrismaService global y busca la reserva por
 * proveedorOrdenId (único en la práctica, aunque no forzado en BD, ya
 * que Duffel es una única cuenta compartida entre tenants), mismo
 * criterio que EmisionECfService.actualizarPorWebhook. Nunca toca
 * `estado` ni el ledger — ver comentario en schema.prisma sobre por qué.
 */
@Injectable()
export class DuffelWebhookService {
  private readonly logger = new Logger(DuffelWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  async procesarEvento(evento: DuffelWebhookEvento): Promise<void> {
    const tipo = evento.type;
    if (!tipo || !(tipo in DETALLE_POR_TIPO)) {
      this.logger.warn(`Webhook de Duffel con tipo no manejado: ${tipo ?? '(sin type)'}`);
      return;
    }

    const proveedorOrdenId = evento.data?.order_id ?? evento.data?.object?.order_id ?? evento.object_id ?? evento.data?.id ?? evento.data?.object?.id;
    if (!proveedorOrdenId) {
      this.logger.warn(`Webhook de Duffel de tipo "${tipo}" sin un id de orden reconocible: ${JSON.stringify(evento)}`);
      return;
    }

    const resultado = await this.prisma.travelReserva.updateMany({
      where: { proveedorOrdenId },
      data: {
        alertaProveedorTipo: TIPO_ALERTA[tipo],
        alertaProveedorDetalle: DETALLE_POR_TIPO[tipo],
        alertaProveedorEn: new Date(),
      },
    });

    if (resultado.count === 0) {
      this.logger.warn(`Webhook de Duffel de tipo "${tipo}" no coincide con ninguna reserva (proveedorOrdenId=${proveedorOrdenId})`);
    }
  }
}
