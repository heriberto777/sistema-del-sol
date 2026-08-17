import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PERMISOS_PLATAFORMA_BASE } from '../src/platform-auth/platform-roles-base';

/**
 * Crea (o actualiza la contraseña de) el primer super admin de plataforma.
 * No hay alta por HTTP a propósito — el primer admin se siembra desde el
 * servidor, con acceso directo a las variables de entorno. Le asigna el
 * rol "Super Admin" (todos los permisos de plataforma) — lo crea inline
 * si `platform-roles:seed` no corrió todavía, para que el primer admin
 * jamás quede sin acceso.
 *
 * Uso:
 *   PLATFORM_ADMIN_EMAIL=tu@correo.com PLATFORM_ADMIN_PASSWORD=algo-seguro \
 *     pnpm --filter ./backend platform:bootstrap-admin
 */
async function main() {
  const email = process.argv[2] ?? process.env.PLATFORM_ADMIN_EMAIL;
  const password = process.argv[3] ?? process.env.PLATFORM_ADMIN_PASSWORD;
  const nombre = process.argv[4] ?? process.env.PLATFORM_ADMIN_NOMBRE ?? 'Super Admin';

  if (!email || !password) {
    console.error(
      'Falta email/password. Uso: PLATFORM_ADMIN_EMAIL=... PLATFORM_ADMIN_PASSWORD=... pnpm --filter ./backend platform:bootstrap-admin',
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('La contraseña debe tener al menos 8 caracteres.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const passwordHash = await bcrypt.hash(password, 10);

  for (const clave of PERMISOS_PLATAFORMA_BASE) {
    await prisma.platformPermission.upsert({ where: { clave }, update: {}, create: { clave } });
  }
  const superAdminRol = await prisma.platformRole.upsert({
    where: { nombre: 'Super Admin' },
    update: {},
    create: { nombre: 'Super Admin' },
  });
  const permisosDb = await prisma.platformPermission.findMany({ where: { clave: { in: PERMISOS_PLATAFORMA_BASE } } });
  await prisma.platformRolePermission.deleteMany({ where: { roleId: superAdminRol.id } });
  await prisma.platformRolePermission.createMany({
    data: permisosDb.map((p) => ({ roleId: superAdminRol.id, permissionId: p.id })),
  });

  const admin = await prisma.platformAdmin.upsert({
    where: { email },
    update: { passwordHash, nombre, activo: true, roleId: superAdminRol.id },
    create: { email, passwordHash, nombre, roleId: superAdminRol.id },
  });

  console.log(`Platform admin listo: ${admin.email} (${admin.id}), rol: Super Admin`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
