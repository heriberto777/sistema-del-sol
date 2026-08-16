import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

// Nunca seleccionar passwordHash hacia afuera de este repositorio.
const SELECT_USUARIO = {
  id: true,
  email: true,
  nombre: true,
  activo: true,
  createdAt: true,
  roles: { select: { role: { select: { id: true, nombre: true } } } },
} as const;

@Injectable()
export class UsuariosRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(email: string, nombre: string, passwordHash: string, rolIds: string[], tenantId: string) {
    return this.db.user.create({
      data: {
        tenantId,
        email,
        nombre,
        passwordHash,
        roles: { create: rolIds.map((roleId) => ({ roleId })) },
      },
      select: SELECT_USUARIO,
    });
  }

  listar(params: { skip: number; take: number; busqueda?: string }) {
    const where = params.busqueda
      ? {
          OR: [
            { nombre: { contains: params.busqueda, mode: 'insensitive' as const } },
            { email: { contains: params.busqueda, mode: 'insensitive' as const } },
          ],
        }
      : {};
    return Promise.all([
      this.db.user.findMany({ where, orderBy: { nombre: 'asc' }, select: SELECT_USUARIO, skip: params.skip, take: params.take }),
      this.db.user.count({ where }),
    ]);
  }

  buscarPorId(id: string) {
    return this.db.user.findUniqueOrThrow({ where: { id }, select: SELECT_USUARIO });
  }

  actualizarDatos(id: string, data: { nombre?: string; activo?: boolean }) {
    return this.db.user.update({ where: { id }, data, select: SELECT_USUARIO });
  }

  async reemplazarRoles(id: string, rolIds: string[]) {
    await this.db.userRole.deleteMany({ where: { userId: id } });
    await this.db.userRole.createMany({ data: rolIds.map((roleId) => ({ userId: id, roleId })) });
    return this.buscarPorId(id);
  }

  listarRoles() {
    return this.db.role.findMany({ orderBy: { nombre: 'asc' } });
  }

  listarPermisos() {
    return this.db.permission.findMany({ orderBy: { clave: 'asc' } });
  }

  buscarRolPorId(id: string) {
    return this.db.role.findUniqueOrThrow({
      where: { id },
      include: { rolePermissions: { include: { permission: true } } },
    });
  }

  async crearRol(tenantId: string, nombre: string, descripcion: string | undefined, permisos: string[]) {
    const rolId = await this.db.$transaction(async (tx) => {
      const rol = await tx.role.create({ data: { tenantId, nombre, descripcion, esSistema: false } });
      for (const clave of permisos) {
        const permiso = await tx.permission.findUniqueOrThrow({ where: { clave } });
        await tx.rolePermission.create({ data: { roleId: rol.id, permissionId: permiso.id } });
      }
      return rol.id;
    });
    return this.buscarRolPorId(rolId);
  }

  async actualizarRol(id: string, data: { nombre?: string; descripcion?: string; permisos?: string[] }) {
    await this.db.$transaction(async (tx) => {
      if (data.nombre !== undefined || data.descripcion !== undefined) {
        await tx.role.update({ where: { id }, data: { nombre: data.nombre, descripcion: data.descripcion } });
      }
      if (data.permisos) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        for (const clave of data.permisos) {
          const permiso = await tx.permission.findUniqueOrThrow({ where: { clave } });
          await tx.rolePermission.create({ data: { roleId: id, permissionId: permiso.id } });
        }
      }
    });
    return this.buscarRolPorId(id);
  }

  eliminarRol(id: string) {
    return this.db.role.delete({ where: { id } });
  }

  contarUsuariosConRol(id: string) {
    return this.db.userRole.count({ where: { roleId: id } });
  }
}
