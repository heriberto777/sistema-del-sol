import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearPuestoDto } from './dto/crear-puesto.dto';

@Injectable()
export class PuestosRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(dto: CrearPuestoDto, tenantId: string) {
    return this.db.puesto.create({ data: { ...dto, tenantId } });
  }

  listar(soloActivos: boolean) {
    return this.db.puesto.findMany({ where: soloActivos ? { activo: true } : undefined, orderBy: { nombre: 'asc' } });
  }

  buscarPorId(id: string) {
    return this.db.puesto.findUniqueOrThrow({ where: { id } });
  }

  actualizar(id: string, dto: Partial<CrearPuestoDto>) {
    return this.db.puesto.update({ where: { id }, data: dto });
  }
}
