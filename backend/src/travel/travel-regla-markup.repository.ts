import { Injectable } from '@nestjs/common';
import { TipoTravelReserva } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearReglaMarkupDto } from './dto/crear-regla-markup.dto';

@Injectable()
export class TravelReglaMarkupRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(datos: CrearReglaMarkupDto, tenantId: string) {
    return this.db.travelReglaMarkup.create({ data: { ...datos, tenantId } });
  }

  listar() {
    return this.db.travelReglaMarkup.findMany({ orderBy: { createdAt: 'desc' } });
  }

  buscarPorId(id: string) {
    return this.db.travelReglaMarkup.findFirstOrThrow({ where: { id } });
  }

  actualizar(id: string, datos: Partial<CrearReglaMarkupDto>) {
    return this.db.travelReglaMarkup.update({ where: { id }, data: datos });
  }

  eliminar(id: string) {
    return this.db.travelReglaMarkup.delete({ where: { id } });
  }

  /** La más específica (por tipo) gana sobre la global (tipo null) — ambas deben estar activas. */
  async buscarActivaPara(tipo: TipoTravelReserva) {
    const especifica = await this.db.travelReglaMarkup.findFirst({ where: { tipo, activa: true } });
    if (especifica) return especifica;
    return this.db.travelReglaMarkup.findFirst({ where: { tipo: null, activa: true } });
  }
}
