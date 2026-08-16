import { Injectable } from '@nestjs/common';
import { CanalNotificacion, EstadoNotificacion } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CrearPlantillaDto } from './dto/crear-plantilla.dto';

@Injectable()
export class NotificacionesRepository {
  constructor(private readonly prisma: PrismaService) {}

  buscarPlantilla(tenantId: string, canal: CanalNotificacion, clave: string) {
    return this.prisma.notificacionPlantilla.findUnique({
      where: { tenantId_canal_clave: { tenantId, canal, clave } },
    });
  }

  listarPlantillas(tenantId: string) {
    return this.prisma.notificacionPlantilla.findMany({ where: { tenantId } });
  }

  upsertPlantilla(tenantId: string, dto: CrearPlantillaDto) {
    return this.prisma.notificacionPlantilla.upsert({
      where: { tenantId_canal_clave: { tenantId, canal: dto.canal, clave: dto.clave } },
      update: { asunto: dto.asunto, cuerpo: dto.cuerpo, activa: dto.activa },
      create: { tenantId, ...dto },
    });
  }

  crearNotificacion(tenantId: string, canal: CanalNotificacion, destinatario: string, asunto: string | undefined, cuerpo: string) {
    return this.prisma.notificacion.create({
      data: { tenantId, canal, destinatario, asunto, cuerpo },
    });
  }

  marcarEstado(id: string, estado: EstadoNotificacion) {
    return this.prisma.notificacion.update({
      where: { id },
      data: { estado, enviadaEn: estado === 'ENVIADA' ? new Date() : undefined },
    });
  }

  listarPorTenant(tenantId: string, params: { skip: number; take: number; busqueda?: string }) {
    const where = {
      tenantId,
      ...(params.busqueda
        ? {
            OR: [
              { destinatario: { contains: params.busqueda, mode: 'insensitive' as const } },
              { asunto: { contains: params.busqueda, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    return Promise.all([
      this.prisma.notificacion.findMany({ where, orderBy: { createdAt: 'desc' }, skip: params.skip, take: params.take }),
      this.prisma.notificacion.count({ where }),
    ]);
  }
}
