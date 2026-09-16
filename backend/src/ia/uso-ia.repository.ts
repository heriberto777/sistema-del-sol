import { Injectable } from '@nestjs/common';
import { TipoUsoIa } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsoIaRepository {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly prisma: PrismaService,
  ) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  // `tenantId` explícito acá (y no solo el que ya inyecta TenantPrismaService
  // en runtime) porque el tipo generado de Prisma para `create` exige el
  // campo — mismo patrón que WhatsappConfigRepository.crear/EmailConfigTenantRepository.crear.
  registrar(tenantId: string, tipo: TipoUsoIa) {
    return this.db.usoIaTenant.create({ data: { tenantId, tipo } });
  }

  /** Mismo criterio que PublicacionesSocialesRepository.contarGeneracionesIaDelMes — mes calendario, no ventana móvil de 30 días. */
  contarDelMes(tipo: TipoUsoIa) {
    const ahora = new Date();
    const inicioDeMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    return this.db.usoIaTenant.count({ where: { tipo, createdAt: { gte: inicioDeMes } } });
  }

  /** `PlataformaConfiguracion` es fila única, NO tenant-scoped — `PrismaService` global, mismo criterio que `PublicacionesSocialesRepository.buscarLimiteIaFondo`. */
  async buscarLimites(): Promise<{ imagen: number; asistente: number }> {
    const config = await this.prisma.plataformaConfiguracion.findFirst({
      select: { iaImagenLimiteMensual: true, iaAsistenteLimiteMensual: true },
    });
    return {
      imagen: config?.iaImagenLimiteMensual ?? 20,
      asistente: config?.iaAsistenteLimiteMensual ?? 50,
    };
  }
}
