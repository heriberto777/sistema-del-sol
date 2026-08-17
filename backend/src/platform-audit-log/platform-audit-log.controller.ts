import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../common/decorators/public.decorator';
import { PlatformPermissions } from '../common/decorators/platform-permissions.decorator';
import { PlatformAuthGuard } from '../platform-auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../common/guards/platform-permissions.guard';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { paginar } from '../common/types/pagina-resultado';

@ApiBearerAuth()
@ApiTags('platform-audit-log')
@Public() // el JwtAuthGuard global de tenants no debe intervenir aquí
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/audit-log')
export class PlatformAuditLogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @PlatformPermissions('platform.auditoria.ver')
  async listar(@Query() query: ListadoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const where = query.busqueda
      ? {
          OR: [
            { accion: { contains: query.busqueda, mode: 'insensitive' as const } },
            { entidad: { contains: query.busqueda, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [datos, total] = await Promise.all([
      this.prisma.platformAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { admin: { select: { nombre: true, email: true } } },
        skip,
        take,
      }),
      this.prisma.platformAuditLog.count({ where }),
    ]);

    return { datos, total, pagina, tamanoPagina };
  }
}
