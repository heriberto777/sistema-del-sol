import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearFeriadoDto } from './dto/crear-feriado.dto';

@Injectable()
export class FeriadosRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(dto: CrearFeriadoDto, tenantId: string) {
    return this.db.feriado.create({ data: { ...dto, fecha: new Date(dto.fecha), tenantId } });
  }

  listar(soloActivos: boolean) {
    return this.db.feriado.findMany({ where: soloActivos ? { activo: true } : undefined, orderBy: { fecha: 'asc' } });
  }

  buscarPorId(id: string) {
    return this.db.feriado.findUniqueOrThrow({ where: { id } });
  }

  actualizar(id: string, dto: Partial<CrearFeriadoDto>) {
    const { fecha, ...resto } = dto;
    return this.db.feriado.update({ where: { id }, data: { ...resto, ...(fecha ? { fecha: new Date(fecha) } : {}) } });
  }

  eliminar(id: string) {
    return this.db.feriado.delete({ where: { id } });
  }
}
