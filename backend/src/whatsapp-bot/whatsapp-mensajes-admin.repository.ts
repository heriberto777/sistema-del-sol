import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

/**
 * Usa `TenantPrismaService` — solo lo consume la bandeja de Admin
 * (autenticada, `admin.configuracion`). Ver `WhatsappMensajesRepository`
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
