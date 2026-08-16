import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearProveedorDto } from './dto/crear-proveedor.dto';

@Injectable()
export class ProveedoresRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(dto: CrearProveedorDto, tenantId: string) {
    return this.db.proveedor.create({ data: { ...dto, tenantId } });
  }

  listar(params: { skip: number; take: number; busqueda?: string }) {
    const where = {
      activo: true,
      ...(params.busqueda
        ? {
            OR: [
              { nombre: { contains: params.busqueda, mode: 'insensitive' as const } },
              { rnc: { contains: params.busqueda, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    return Promise.all([
      this.db.proveedor.findMany({ where, orderBy: { nombre: 'asc' }, skip: params.skip, take: params.take }),
      this.db.proveedor.count({ where }),
    ]);
  }

  buscarPorId(id: string) {
    return this.db.proveedor.findUniqueOrThrow({ where: { id } });
  }

  actualizar(id: string, dto: Partial<CrearProveedorDto>) {
    return this.db.proveedor.update({ where: { id }, data: dto });
  }
}
