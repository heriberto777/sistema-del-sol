import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearUnidadMedidaDto } from './dto/crear-unidad-medida.dto';

@Injectable()
export class UnidadesMedidaRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(dto: CrearUnidadMedidaDto, tenantId: string) {
    return this.db.unidadMedida.create({ data: { ...dto, tenantId } });
  }

  listar(soloActivas: boolean) {
    return this.db.unidadMedida.findMany({
      where: soloActivas ? { activa: true } : undefined,
      orderBy: { nombre: 'asc' },
    });
  }

  buscarPorId(id: string) {
    return this.db.unidadMedida.findUniqueOrThrow({ where: { id } });
  }

  actualizar(id: string, dto: Partial<CrearUnidadMedidaDto>) {
    return this.db.unidadMedida.update({ where: { id }, data: dto });
  }
}
