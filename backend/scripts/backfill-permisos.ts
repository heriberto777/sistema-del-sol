import { PrismaClient } from '@prisma/client';
import { ROLES_BASE } from '../src/tenants/roles-base';

/**
 * Agrega a los tenants YA existentes los permisos que se hayan sumado a
 * ROLES_BASE (`src/tenants/roles-base.ts`) después de que ese tenant fuera
 * provisionado. `TenantsRepository.crearConProvisioning` solo siembra
 * ROLES_BASE una vez, al crear el tenant — un permiso agregado más tarde
 * nunca llega a los roles de un tenant ya existente sin este script (ver
 * docs/ARCHITECTURE.md, sección "Plugin system" / nota de mantenimiento).
 *
 * Idempotente: solo agrega lo que falta, nunca borra ni recrea nada — se
 * puede correr tantas veces como haga falta sin duplicar RolePermission.
 *
 * Uso: pnpm --filter ./backend permisos:backfill
 */
async function main() {
  const prisma = new PrismaClient();

  for (const clave of Object.values(ROLES_BASE).flat()) {
    await prisma.permission.upsert({ where: { clave }, update: {}, create: { clave } });
  }

  const tenants = await prisma.tenant.findMany({ select: { id: true, nombre: true } });
  let totalAgregados = 0;

  for (const tenant of tenants) {
    for (const [nombreRol, permisosEsperados] of Object.entries(ROLES_BASE)) {
      const rol = await prisma.role.findUnique({
        where: { tenantId_nombre: { tenantId: tenant.id, nombre: nombreRol } },
        include: { rolePermissions: { include: { permission: true } } },
      });
      if (!rol) continue;

      const clavesActuales = new Set(rol.rolePermissions.map((rp) => rp.permission.clave));
      const faltantes = permisosEsperados.filter((clave) => !clavesActuales.has(clave));
      if (faltantes.length === 0) continue;

      for (const clave of faltantes) {
        const permiso = await prisma.permission.findUniqueOrThrow({ where: { clave } });
        await prisma.rolePermission.create({ data: { roleId: rol.id, permissionId: permiso.id } });
      }

      totalAgregados += faltantes.length;
      console.log(`${tenant.nombre} / ${nombreRol}: +${faltantes.length} permiso(s) — ${faltantes.join(', ')}`);
    }
  }

  console.log(totalAgregados > 0 ? `Listo: ${totalAgregados} permiso(s) agregado(s) en total.` : 'Nada que agregar — todos los tenants ya tienen los permisos de ROLES_BASE.');
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
