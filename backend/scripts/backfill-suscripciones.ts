import { PrismaClient } from '@prisma/client';

/**
 * A cualquier tenant con planId asignado pero sin Suscripcion (todos los
 * existentes antes de esta feature, ej. "demo", más los que se hayan
 * creado directo por Prisma en vez de vía TenantsService.crear) le crea
 * una, con fechaProximoCorte: hoy — la primera factura sale en el
 * próximo tick del cron de facturación de plataforma.
 *
 * Idempotente: solo toca tenants con planId no nulo y sin Suscripcion.
 *
 * Uso: pnpm --filter ./backend suscripciones:backfill
 */
async function main() {
  const prisma = new PrismaClient();

  const tenants = await prisma.tenant.findMany({
    where: { planId: { not: null }, suscripcion: null },
    select: { id: true, nombre: true, planId: true },
  });

  for (const tenant of tenants) {
    await prisma.suscripcion.create({
      data: { tenantId: tenant.id, planId: tenant.planId!, fechaProximoCorte: new Date() },
    });
    console.log(`Suscripción creada para "${tenant.nombre}"`);
  }

  console.log(tenants.length > 0 ? `Listo: ${tenants.length} suscripción(es) creada(s).` : 'Nada que hacer — todos los tenants con plan ya tienen suscripción.');
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
