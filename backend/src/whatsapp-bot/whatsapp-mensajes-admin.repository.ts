import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

/**
 * Usa `TenantPrismaService` — solo lo consume la bandeja de Admin
 * (autenticada, `whatsapp.bandeja.usar`). Ver `WhatsappMensajesRepository`
 * (público, sin JWT, `PrismaService` global) para el porqué de la
 * separación en dos clases.
 */
@Injectable()
export class WhatsappMensajesAdminRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  listarPendientes() {
    return this.tenantPrisma.client.whatsappMensaje.findMany({
      where: { requiereAtencionHumana: true, atendido: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Hilo completo (todos los roles, no solo lo pendiente) para pintar la conversación tipo chat en el drawer. */
  obtenerConversacion(telefono: string) {
    return this.tenantPrisma.client.whatsappMensaje.findMany({
      where: { telefono },
      orderBy: { createdAt: 'asc' },
    });
  }

  marcarAtendidosPorTelefono(telefono: string) {
    return this.tenantPrisma.client.whatsappMensaje.updateMany({
      where: { telefono, requiereAtencionHumana: true, atendido: false },
      data: { atendido: true },
    });
  }

  crearRespuestaManual(tenantId: string, telefono: string, contenido: string, diaRD: string) {
    return this.tenantPrisma.client.whatsappMensaje.create({
      data: { tenantId, telefono, rol: 'HUMANO', contenido, diaRD },
    });
  }
}
