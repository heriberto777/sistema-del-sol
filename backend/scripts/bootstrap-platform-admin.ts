import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

/**
 * Crea (o actualiza la contraseña de) el primer super admin de plataforma.
 * No hay alta por HTTP a propósito — el primer admin se siembra desde el
 * servidor, con acceso directo a las variables de entorno.
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

  const admin = await prisma.platformAdmin.upsert({
    where: { email },
    update: { passwordHash, nombre, activo: true },
    create: { email, passwordHash, nombre },
  });

  console.log(`Platform admin listo: ${admin.email} (${admin.id})`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
