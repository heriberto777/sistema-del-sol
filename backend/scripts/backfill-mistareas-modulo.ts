import { PrismaClient } from '@prisma/client';

/**
 * "Mis Tareas" era siempre-on para todo tenant; pasó a ser gateado por
 * `@RequiereModulo('mistareas')`. Este backfill le da a CADA tenant
 * existente un `TenantModuloOverride(activo:true)` explícito para el
 * módulo, sin importar su Plan — así ninguno pierde acceso al desplegar
 * el gate (los tenants nuevos ya lo reciben vía Plan, ver PLANES_BASE en
 * modulos-base.ts; un tenant con un Plan custom que no lo incluya igual
 * queda cubierto acá por el override).
 *
 * Requiere haber corrido `planes:seed` antes (crea el catálogo Modulo
 * 'mistareas' si no existe). Idempotente: usa upsert por
 * (tenantId, moduloId), se puede correr de nuevo sin duplicar nada.
 *
 * Uso: pnpm --filter ./backend mistareas:backfill
 */
async function main() {
  const prisma = new PrismaClient();

  const modulo = await prisma.modulo.upsert({
    where: { clave: 'mistareas' },
    update: {},
    create: { clave: 'mistareas', nombre: 'Mis Tareas' },
  });

  const tenants = await prisma.tenant.findMany({ select: { id: true } });

  for (const tenant of tenants) {
    await prisma.tenantModuloOverride.upsert({
      where: { tenantId_moduloId: { tenantId: tenant.id, moduloId: modulo.id } },
      update: { activo: true },
      create: { tenantId: tenant.id, moduloId: modulo.id, activo: true },
    });
  }

  console.log(`Listo: ${tenants.length} tenant(s) con "mistareas" activo garantizado.`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
