import { PrismaClient } from '@prisma/client';

/**
 * Período Contable — ítem "Fase 1". Un tenant creado ANTES de esta
 * feature no tiene ningún PeriodoContable (a diferencia de uno nuevo, que
 * ya lo recibe en TenantsRepository.crearConProvisioning). Sin esto,
 * `CierrePeriodoService.validarPeriodoAbierto` rechazaría cualquier
 * asiento manual/gasto rápido/gasto menor/pago con fecha de hoy, porque
 * "no hay ningún período definido" — bloquearía todo de inmediato.
 *
 * `fechaInicio` del primer período de cada tenant se fija en el epoch
 * (1970-01-01), NO al día 1 del mes en curso — a propósito: así, cuando
 * el tenant cierre este primer período, `lineasEnRango` arrastra TODO el
 * histórico de Ingreso/Gasto acumulado desde siempre (igual semántica que
 * el viejo `cerrarPeriodo` sin cierres previos: "desde el inicio"), en vez
 * de perder silenciosamente lo que ya existía antes de este rollout. Los
 * períodos siguientes (creados por PeriodosContablesCronService) sí usan
 * meses naturales normales.
 *
 * Idempotente — un tenant que ya tenga algún PeriodoContable se salta.
 *
 * Uso: pnpm --filter ./backend periodos-contables:backfill
 */
async function main() {
  const prisma = new PrismaClient();

  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  const hoy = new Date();
  const fechaFin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999);

  let creados = 0;
  for (const tenant of tenants) {
    const yaTiene = await prisma.periodoContable.findFirst({ where: { tenantId: tenant.id } });
    if (yaTiene) continue;

    await prisma.periodoContable.create({
      data: { tenantId: tenant.id, fechaInicio: new Date(0), fechaFin },
    });
    creados++;
  }

  console.log(`Listo: ${creados} tenant(s) con su primer período contable creado (abierto, cubre todo el histórico hasta hoy).`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
