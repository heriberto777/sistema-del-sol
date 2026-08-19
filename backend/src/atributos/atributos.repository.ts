import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class AtributosRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(nombre: string, tenantId: string) {
    return this.db.atributo.create({ data: { nombre, tenantId } });
  }

  listar() {
    return this.db.atributo.findMany({
      orderBy: { nombre: 'asc' },
      include: { valores: { orderBy: { valor: 'asc' } } },
    });
  }

  buscarPorId(id: string) {
    return this.db.atributo.findUniqueOrThrow({
      where: { id },
      include: { valores: { include: { _count: { select: { variantes: true } } } } },
    });
  }

  crearValor(atributoId: string, valor: string) {
    return this.db.valorAtributo.create({ data: { atributoId, valor } });
  }

  eliminarValor(id: string) {
    return this.db.valorAtributo.delete({ where: { id } });
  }

  eliminarAtributo(id: string) {
    return this.db.atributo.delete({ where: { id } });
  }
}
