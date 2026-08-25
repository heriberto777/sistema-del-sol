import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearTasaCambioDto } from './dto/crear-tasa-cambio.dto';

@Injectable()
export class TasasCambioRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(dto: CrearTasaCambioDto, tenantId: string) {
    return this.db.tasaCambio.create({ data: { ...dto, tenantId } });
  }

  listar() {
    return this.db.tasaCambio.findMany({ orderBy: { moneda: 'asc' } });
  }

  /** `findFirst`, no `findUnique` — evita depender del nombre exacto del índice compuesto `[tenantId, moneda]`; el `tenantId` lo inyecta solo la extensión de TenantPrismaService. */
  buscarPorMoneda(moneda: string) {
    return this.db.tasaCambio.findFirst({ where: { moneda } });
  }

  actualizar(id: string, dto: Partial<CrearTasaCambioDto>) {
    return this.db.tasaCambio.update({ where: { id }, data: dto });
  }

  eliminar(id: string) {
    return this.db.tasaCambio.delete({ where: { id } });
  }
}
