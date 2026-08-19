import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearListaPrecioDto } from './dto/crear-lista-precio.dto';

@Injectable()
export class ListasPrecioRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(dto: CrearListaPrecioDto, tenantId: string) {
    return this.db.listaPrecio.create({ data: { ...dto, tenantId } });
  }

  listar(soloActivas: boolean) {
    return this.db.listaPrecio.findMany({
      where: soloActivas ? { activa: true } : undefined,
      orderBy: { nombre: 'asc' },
    });
  }

  buscarPorId(id: string) {
    return this.db.listaPrecio.findUniqueOrThrow({ where: { id } });
  }

  actualizar(id: string, dto: Partial<CrearListaPrecioDto>) {
    return this.db.listaPrecio.update({ where: { id }, data: dto });
  }
}
