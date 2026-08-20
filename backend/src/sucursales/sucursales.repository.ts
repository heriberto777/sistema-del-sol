import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class SucursalesRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(tenantId: string, data: { nombre: string; nombreComercial?: string; telefono?: string; direccion?: string; ciudad?: string }) {
    return this.db.sucursal.create({ data: { tenantId, ...data } });
  }

  listar() {
    return this.db.sucursal.findMany({ where: { activa: true }, orderBy: { nombre: 'asc' } });
  }

  /** Lanza (404) si la sucursal no existe o no pertenece al tenant actual — Sucursal es tenant-scoped, TenantPrismaService inyecta el filtro. */
  buscarPorId(id: string) {
    return this.db.sucursal.findUniqueOrThrow({ where: { id } });
  }

  actualizar(
    id: string,
    data: Partial<{ nombre: string; nombreComercial: string; telefono: string; direccion: string; ciudad: string; activa: boolean }>,
  ) {
    return this.db.sucursal.update({ where: { id }, data });
  }
}
