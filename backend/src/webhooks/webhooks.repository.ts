import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WebhooksRepository {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly prisma: PrismaService,
  ) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(url: string, eventos: string[], secret: string, tenantId: string) {
    return this.db.webhook.create({ data: { url, eventos, secret, tenantId } });
  }

  listar() {
    return this.db.webhook.findMany();
  }

  buscarPorId(id: string) {
    return this.db.webhook.findUniqueOrThrow({ where: { id } });
  }

  eliminar(id: string) {
    return this.db.webhook.delete({ where: { id } });
  }

  /** El tenantId ya se validó en `buscarPorId` (el modelo Webhook sí está tenant-scoped) — ver WebhooksService.listarEntregas. */
  listarEntregas(webhookId: string) {
    return this.db.webhookDelivery.findMany({ where: { webhookId }, orderBy: { createdAt: 'desc' } });
  }

  /** Usado por el dispatcher, fuera del contexto de un request HTTP. */
  buscarActivosPorEvento(tenantId: string, evento: string) {
    return this.prisma.webhook.findMany({
      where: { tenantId, activo: true, eventos: { has: evento } },
    });
  }

  registrarEntrega(
    webhookId: string,
    evento: string,
    payload: unknown,
    statusCode: number | null,
    exitoso: boolean,
    intentos: number,
  ) {
    return this.prisma.webhookDelivery.create({
      data: { webhookId, evento, payload: payload as object, statusCode: statusCode ?? undefined, exitoso, intentos },
    });
  }
}
