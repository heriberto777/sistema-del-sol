import { PrismaClient } from '@prisma/client';
import { MODULOS_BASE, PLANES_BASE } from '../src/tenants/modulos-base';

/**
 * Siembra el catálogo GLOBAL de módulos y los planes por defecto
 * (Básico/Profesional/Premium) — a diferencia de PERMISOS_BASE/
 * CUENTAS_BASE (que se siembran POR TENANT en cada provisioning), esto
 * es un catálogo único para toda la plataforma, se corre una sola vez
 * por entorno.
 *
 * Idempotente: upsert de cada Modulo (por clave) y cada Plan (por
 * nombre), sincronizando sus PlanModulo a lo que diga PLANES_BASE
 * actualmente (se puede correr de nuevo tras editar el catálogo en
 * código).
 *
 * Uso: pnpm --filter ./backend planes:seed
 */
async function main() {
  const prisma = new PrismaClient();

  for (const modulo of MODULOS_BASE) {
    await prisma.modulo.upsert({
      where: { clave: modulo.clave },
      update: { nombre: modulo.nombre },
      create: { clave: modulo.clave, nombre: modulo.nombre },
    });
  }

  for (const [nombre, { descripcion, modulos }] of Object.entries(PLANES_BASE)) {
    const plan = await prisma.plan.upsert({
      where: { nombre },
      update: { descripcion },
      create: { nombre, descripcion },
    });

    const modulosDb = await prisma.modulo.findMany({ where: { clave: { in: modulos } } });
    await prisma.planModulo.deleteMany({ where: { planId: plan.id } });
    await prisma.planModulo.createMany({
      data: modulosDb.map((m) => ({ planId: plan.id, moduloId: m.id })),
    });

    console.log(`Plan "${nombre}": ${modulosDb.length} módulo(s)`);
  }

  console.log('Listo: catálogo de módulos y planes sembrado.');
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
