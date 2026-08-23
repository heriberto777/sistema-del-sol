import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearCategoriaClienteDto } from './dto/crear-categoria-cliente.dto';

@Injectable()
export class CategoriasClienteRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(dto: CrearCategoriaClienteDto, tenantId: string) {
    return this.db.categoriaCliente.create({ data: { ...dto, tenantId } });
  }

  listar(soloActivas: boolean) {
    return this.db.categoriaCliente.findMany({
      where: soloActivas ? { activa: true } : undefined,
      orderBy: { nombre: 'asc' },
    });
  }

  buscarPorId(id: string) {
    return this.db.categoriaCliente.findUniqueOrThrow({ where: { id } });
  }

  actualizar(id: string, dto: Partial<CrearCategoriaClienteDto>) {
    return this.db.categoriaCliente.update({ where: { id }, data: dto });
  }
}
