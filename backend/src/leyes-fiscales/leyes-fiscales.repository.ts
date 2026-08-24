import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearLeyFiscalDto } from './dto/crear-ley-fiscal.dto';

@Injectable()
export class LeyesFiscalesRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(dto: CrearLeyFiscalDto, tenantId: string) {
    return this.db.leyFiscal.create({ data: { ...dto, tenantId } });
  }

  listar(soloActivas: boolean) {
    return this.db.leyFiscal.findMany({ where: soloActivas ? { activa: true } : undefined, orderBy: { nombre: 'asc' } });
  }

  buscarPorId(id: string) {
    return this.db.leyFiscal.findUniqueOrThrow({ where: { id } });
  }

  actualizar(id: string, dto: Partial<CrearLeyFiscalDto>) {
    return this.db.leyFiscal.update({ where: { id }, data: dto });
  }
}
