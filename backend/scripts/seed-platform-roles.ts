import { PrismaClient } from '@prisma/client';
import { PERMISOS_PLATAFORMA_BASE, ROLES_PLATAFORMA_BASE } from '../src/platform-auth/platform-roles-base';

/**
 * Siembra el catálogo GLOBAL de permisos y roles de PLATAFORMA (Super
 * Admin/Ventas/Soporte) — igual criterio que seed-planes.ts: catálogo
 * único para toda la plataforma, se corre una sola vez por entorno.
 *
 * Idempotente: upsert de cada PlatformPermission (por clave) y cada
 * PlatformRole (por nombre), sincronizando sus PlatformRolePermission a
 * lo que diga ROLES_PLATAFORMA_BASE actualmente.
 *
 * Uso: pnpm --filter ./backend platform-roles:seed
 */
async function main() {
  const prisma = new PrismaClient();

  for (const clave of PERMISOS_PLATAFORMA_BASE) {
    await prisma.platformPermission.upsert({ where: { clave }, update: {}, create: { clave } });
  }

  for (const [nombre, permisos] of Object.entries(ROLES_PLATAFORMA_BASE)) {
    const rol = await prisma.platformRole.upsert({ where: { nombre }, update: {}, create: { nombre } });

    const permisosDb = await prisma.platformPermission.findMany({ where: { clave: { in: permisos } } });
    await prisma.platformRolePermission.deleteMany({ where: { roleId: rol.id } });
    await prisma.platformRolePermission.createMany({
      data: permisosDb.map((p) => ({ roleId: rol.id, permissionId: p.id })),
    });

    console.log(`Rol de plataforma "${nombre}": ${permisosDb.length} permiso(s)`);
  }

  console.log('Listo: catálogo de permisos y roles de plataforma sembrado.');
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
