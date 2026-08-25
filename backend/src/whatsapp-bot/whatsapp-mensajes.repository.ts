import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Usa `PrismaService` GLOBAL, nunca `TenantPrismaService` — el webhook que
 * consume esto corre sin JWT (`@Public()`), así que no hay
 * `request.user.tenantId` para que `TenantPrismaService` resuelva (lanzaría
 * `ForbiddenException`). Mismo criterio que `SesionesCobroRepository` del
 * ítem C-1. Los métodos de la bandeja de Admin (autenticada) van en
 * `WhatsappMensajesAdminRepository` — a propósito en una clase aparte: mezclar
 * `PrismaService` y `TenantPrismaService` en un mismo constructor rompe el
 * scope-hoisting de Nest (el provider queda SINGLETON en vez de REQUEST, y
 * `TenantPrismaService` llega como stand-in vacío, sin `.client`).
 */
@Injectable()
export class WhatsappMensajesRepository {
  constructor(private readonly prisma: PrismaService) {}

  crear(data: {
    tenantId: string;
    telefono: string;
    rol: 'USUARIO' | 'ASISTENTE' | 'HUMANO';
    contenido: string;
    requiereAtencionHumana?: boolean;
    diaRD: string;
  }) {
    return this.prisma.whatsappMensaje.create({ data });
  }

  contarRespuestasHoy(tenantId: string, diaRD: string): Promise<number> {
    return this.prisma.whatsappMensaje.count({ where: { tenantId, rol: 'ASISTENTE', diaRD } });
  }

  /** Orden cronológico (más viejo primero) — listo para pasarle a la IA como `messages`. */
  async historialReciente(tenantId: string, telefono: string, limite: number) {
    const mensajes = await this.prisma.whatsappMensaje.findMany({
      where: { tenantId, telefono },
      orderBy: { createdAt: 'desc' },
      take: limite,
    });
    return mensajes.reverse();
  }
}
