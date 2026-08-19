import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearCategoriaDto } from './dto/crear-categoria.dto';

@Injectable()
export class CategoriasRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(dto: CrearCategoriaDto, tenantId: string) {
    return this.db.categoria.create({ data: { ...dto, tenantId } });
  }

  listar() {
    return this.db.categoria.findMany({ orderBy: { nombre: 'asc' } });
  }

  buscarPorId(id: string) {
    return this.db.categoria.findUniqueOrThrow({
      where: { id },
      include: { _count: { select: { productos: true, subcategorias: true } } },
    });
  }

  actualizar(id: string, dto: Partial<CrearCategoriaDto>) {
    return this.db.categoria.update({ where: { id }, data: dto });
  }

  eliminar(id: string) {
    return this.db.categoria.delete({ where: { id } });
  }
}
