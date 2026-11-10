import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearCategoriaProveedorDto } from './dto/crear-categoria-proveedor.dto';

@Injectable()
export class CategoriasProveedorRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(dto: CrearCategoriaProveedorDto, tenantId: string) {
    return this.db.categoriaProveedor.create({ data: { ...dto, tenantId } });
  }

  listar(soloActivas: boolean) {
    return this.db.categoriaProveedor.findMany({
      where: soloActivas ? { activa: true } : undefined,
      orderBy: { nombre: 'asc' },
    });
  }

  buscarPorId(id: string) {
    return this.db.categoriaProveedor.findUniqueOrThrow({ where: { id } });
  }

  actualizar(id: string, dto: Partial<CrearCategoriaProveedorDto>) {
    return this.db.categoriaProveedor.update({ where: { id }, data: dto });
  }
}
