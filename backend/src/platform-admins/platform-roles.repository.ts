import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const INCLUDE_ROLE = { permisos: { include: { permission: true } } } as const;

@Injectable()
export class PlatformRolesRepository {
  constructor(private readonly prisma: PrismaService) {}

  listar() {
    return this.prisma.platformRole.findMany({ include: INCLUDE_ROLE, orderBy: { nombre: 'asc' } });
  }

  buscarPorId(id: string) {
    return this.prisma.platformRole.findUniqueOrThrow({ where: { id }, include: INCLUDE_ROLE });
  }

  listarPermisos() {
    return this.prisma.platformPermission.findMany({ orderBy: { clave: 'asc' } });
  }

  async crear(params: { nombre: string; permisos: string[] }) {
    const permisosDb = await this.prisma.platformPermission.findMany({ where: { clave: { in: params.permisos } } });
    return this.prisma.platformRole.create({
      data: {
        nombre: params.nombre,
        permisos: { create: permisosDb.map((p) => ({ permissionId: p.id })) },
      },
      include: INCLUDE_ROLE,
    });
  }

  async actualizar(id: string, params: { nombre?: string; permisos?: string[] }) {
    if (params.permisos) {
      const permisosDb = await this.prisma.platformPermission.findMany({ where: { clave: { in: params.permisos } } });
      await this.prisma.platformRolePermission.deleteMany({ where: { roleId: id } });
      await this.prisma.platformRolePermission.createMany({
        data: permisosDb.map((p) => ({ roleId: id, permissionId: p.id })),
      });
    }
    return this.prisma.platformRole.update({
      where: { id },
      data: { nombre: params.nombre },
      include: INCLUDE_ROLE,
    });
  }
}
