import { PrismaClient } from '@prisma/client';

/**
 * Crea el contacto "Consumidor Final" en los tenants que fueron
 * provisionados ANTES de que TenantsRepository.crearConProvisioning
 * empezara a sembrarlo — mismo problema/patrón que
 * backfill-configuraciones.ts.
 *
 * Idempotente: solo crea si el tenant todavía no tiene ningún Cliente
 * con esConsumidorFinal=true.
 *
 * Uso: pnpm --filter ./backend consumidor-final:backfill
 */
async function main() {
  const prisma = new PrismaClient();

  const tenants = await prisma.tenant.findMany({ select: { id: true, nombre: true } });
  let totalCreados = 0;

  for (const tenant of tenants) {
    const existente = await prisma.cliente.findFirst({ where: { tenantId: tenant.id, esConsumidorFinal: true } });
    if (existente) continue;

    await prisma.cliente.create({
      data: { tenantId: tenant.id, nombre: 'Consumidor Final', esConsumidorFinal: true },
    });
    totalCreados += 1;
    console.log(`${tenant.nombre}: contacto "Consumidor Final" creado.`);
  }

  console.log(totalCreados > 0 ? `Listo: ${totalCreados} tenant(s) actualizados.` : 'Nada que agregar — todos los tenants ya tienen su "Consumidor Final".');
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
