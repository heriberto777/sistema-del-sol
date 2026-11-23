import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearCentroCostoDto } from './dto/crear-centro-costo.dto';

@Injectable()
export class CentrosCostoRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(dto: CrearCentroCostoDto, tenantId: string) {
    return this.db.centroCosto.create({ data: { ...dto, tenantId } });
  }

  listar(soloActivos: boolean) {
    return this.db.centroCosto.findMany({
      where: soloActivos ? { activo: true } : undefined,
      orderBy: { nombre: 'asc' },
    });
  }

  buscarPorId(id: string) {
    return this.db.centroCosto.findUniqueOrThrow({ where: { id } });
  }

  actualizar(id: string, dto: Partial<CrearCentroCostoDto>) {
    return this.db.centroCosto.update({ where: { id }, data: dto });
  }
}
