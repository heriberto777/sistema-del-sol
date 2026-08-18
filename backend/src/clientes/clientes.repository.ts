import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearClienteDto } from './dto/crear-cliente.dto';

@Injectable()
export class ClientesRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(dto: CrearClienteDto, tenantId: string) {
    return this.db.cliente.create({ data: { ...dto, tenantId } });
  }

  listar(params: { skip: number; take: number; busqueda?: string }) {
    const where = {
      activo: true,
      ...(params.busqueda
        ? {
            OR: [
              { nombre: { contains: params.busqueda, mode: 'insensitive' as const } },
              { email: { contains: params.busqueda, mode: 'insensitive' as const } },
              { rncCedula: { contains: params.busqueda, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    return Promise.all([
      this.db.cliente.findMany({ where, orderBy: { nombre: 'asc' }, skip: params.skip, take: params.take }),
      this.db.cliente.count({ where }),
    ]);
  }

  buscarPorId(id: string) {
    return this.db.cliente.findUniqueOrThrow({ where: { id }, include: { direcciones: true } });
  }

  /** Sembrado al provisionar el tenant (ver TenantsRepository.crearConProvisioning) — nunca debería faltar, pero null en vez de throw por si un tenant viejo no fue backfilleado todavía. */
  buscarConsumidorFinal() {
    return this.db.cliente.findFirst({ where: { esConsumidorFinal: true } });
  }

  actualizar(id: string, dto: Partial<CrearClienteDto>) {
    return this.db.cliente.update({ where: { id }, data: dto });
  }
}
