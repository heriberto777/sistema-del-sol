import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearTerminoPagoDto } from './dto/crear-termino-pago.dto';

@Injectable()
export class TerminosPagoRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(dto: CrearTerminoPagoDto, tenantId: string) {
    return this.db.terminoPago.create({ data: { ...dto, tenantId } });
  }

  listar(soloActivos: boolean) {
    return this.db.terminoPago.findMany({
      where: soloActivos ? { activo: true } : undefined,
      orderBy: { dias: 'asc' },
    });
  }

  buscarPorId(id: string) {
    return this.db.terminoPago.findUniqueOrThrow({ where: { id } });
  }

  actualizar(id: string, dto: Partial<CrearTerminoPagoDto>) {
    return this.db.terminoPago.update({ where: { id }, data: dto });
  }
}
