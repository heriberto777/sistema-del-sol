import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearReporteTenantDto } from './dto/crear-reporte-tenant.dto';

@Injectable()
export class ReportesTenantRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  // `tenantId` explícito en `data` — TypeScript no sabe que TenantPrismaService
  // lo inyecta en runtime (eso pasa dentro de $allOperations, invisible al
  // tipado estático de Prisma), mismo patrón que GestionCobroRepository.crearGestion.
  crear(dto: CrearReporteTenantDto, tenantId: string, usuarioId: string) {
    return this.db.reporteTenant.create({
      data: { tenantId, asunto: dto.asunto, descripcion: dto.descripcion, categoria: dto.categoria, usuarioId },
    });
  }

  async listarPropios(params: { skip: number; take: number }) {
    const [datos, total] = await Promise.all([
      this.db.reporteTenant.findMany({
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      this.db.reporteTenant.count(),
    ]);
    return [datos, total] as const;
  }
}
