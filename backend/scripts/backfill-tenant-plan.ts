import { PrismaClient } from '@prisma/client';

/**
 * A cualquier tenant sin plan asignado (planId null — todos los
 * existentes antes de esta feature, ej. "demo") le asigna el plan
 * "Premium" (acceso completo), para que nadie pierda de golpe algo que
 * ya tenía funcionando al introducir el sistema de Planes/módulos.
 * Requiere haber corrido antes `pnpm --filter ./backend planes:seed`.
 *
 * Idempotente: solo toca tenants con planId null.
 *
 * Uso: pnpm --filter ./backend tenant-plan:backfill
 */
async function main() {
  const prisma = new PrismaClient();

  const planPremium = await prisma.plan.findUnique({ where: { nombre: 'Premium' } });
  if (!planPremium) {
    console.error('No existe el plan "Premium" — corré primero `pnpm --filter ./backend planes:seed`.');
    process.exit(1);
  }

  const { count } = await prisma.tenant.updateMany({
    where: { planId: null },
    data: { planId: planPremium.id },
  });

  console.log(count > 0 ? `Listo: ${count} tenant(s) asignado(s) al plan Premium.` : 'Nada que hacer — todos los tenants ya tienen un plan asignado.');
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
