import { Injectable } from '@nestjs/common';
import { EstadoTenant } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISOS_BASE, ROLES_BASE, CONFIGURACIONES_BASE } from './roles-base';
import { CUENTAS_BASE } from '../contabilidad/cuentas-base';

@Injectable()
export class TenantsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listar() {
    return this.prisma.tenant.findMany({ orderBy: { createdAt: 'desc' } });
  }

  buscarPorId(id: string) {
    return this.prisma.tenant.findUniqueOrThrow({ where: { id } });
  }

  actualizar(id: string, data: { nombre?: string; estado?: EstadoTenant; planBase?: string }) {
    return this.prisma.tenant.update({ where: { id }, data });
  }

  /**
   * Provisioning completo de un tenant nuevo: catálogo de permisos (idempotente,
   * por si nunca se corrió el seed global), tenant + settings + configuración
   * por defecto, los roles base con sus permisos, y el usuario administrador
   * inicial. Todo en una sola transacción — o se crea completo, o no se crea
   * nada.
   */
  async crearConProvisioning(params: {
    nombre: string;
    subdominio: string;
    rnc?: string;
    adminEmail: string;
    adminNombre: string;
    adminPasswordHash: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      for (const clave of PERMISOS_BASE) {
        await tx.permission.upsert({ where: { clave }, update: {}, create: { clave } });
      }

      const tenant = await tx.tenant.create({
        data: {
          nombre: params.nombre,
          subdominio: params.subdominio,
          rnc: params.rnc,
          settings: { create: {} },
          configuraciones: {
            create: Object.entries(CONFIGURACIONES_BASE).map(([clave, valor]) => ({ clave, valor })),
          },
        },
      });

      await tx.cuentaContable.createMany({
        data: CUENTAS_BASE.map((c) => ({
          tenantId: tenant.id,
          codigo: c.codigo,
          nombre: c.nombre,
          tipo: c.tipo,
          naturaleza: c.naturaleza,
        })),
      });

      let adminRoleId: string | undefined;
      for (const [nombreRol, permisos] of Object.entries(ROLES_BASE)) {
        const rol = await tx.role.create({
          data: { tenantId: tenant.id, nombre: nombreRol, esSistema: true },
        });
        if (nombreRol === 'Admin Total') adminRoleId = rol.id;

        for (const clave of permisos) {
          const permiso = await tx.permission.findUniqueOrThrow({ where: { clave } });
          await tx.rolePermission.create({ data: { roleId: rol.id, permissionId: permiso.id } });
        }
      }

      const adminUser = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: params.adminEmail,
          nombre: params.adminNombre,
          passwordHash: params.adminPasswordHash,
        },
      });
      await tx.userRole.create({ data: { userId: adminUser.id, roleId: adminRoleId! } });

      return tenant;
    });
  }
}
