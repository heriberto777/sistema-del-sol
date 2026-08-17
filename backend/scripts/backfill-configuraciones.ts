import { PrismaClient } from '@prisma/client';
import { CONFIGURACIONES_BASE } from '../src/tenants/roles-base';

/**
 * Agrega a los tenants YA existentes los parámetros que se hayan sumado a
 * CONFIGURACIONES_BASE (`src/tenants/roles-base.ts`) después de que ese
 * tenant fuera provisionado — mismo problema y mismo patrón que
 * backfill-permisos.ts/backfill-cuentas.ts.
 *
 * Idempotente: usa el índice único (tenantId, clave) para solo crear lo
 * que falta, nunca pisa un valor que el tenant ya haya editado a mano.
 *
 * Uso: pnpm --filter ./backend configuraciones:backfill
 */
async function main() {
  const prisma = new PrismaClient();

  const tenants = await prisma.tenant.findMany({ select: { id: true, nombre: true } });
  let totalAgregadas = 0;

  for (const tenant of tenants) {
    const existentes = await prisma.configuracion.findMany({
      where: { tenantId: tenant.id, clave: { in: Object.keys(CONFIGURACIONES_BASE) } },
      select: { clave: true },
    });
    const clavesExistentes = new Set(existentes.map((c) => c.clave));
    const faltantes = Object.entries(CONFIGURACIONES_BASE).filter(([clave]) => !clavesExistentes.has(clave));
    if (faltantes.length === 0) continue;

    await prisma.configuracion.createMany({
      data: faltantes.map(([clave, valor]) => ({ tenantId: tenant.id, clave, valor })),
    });

    totalAgregadas += faltantes.length;
    console.log(`${tenant.nombre}: +${faltantes.length} parámetro(s) — ${faltantes.map(([clave]) => clave).join(', ')}`);
  }

  console.log(totalAgregadas > 0 ? `Listo: ${totalAgregadas} parámetro(s) agregado(s) en total.` : 'Nada que agregar — todos los tenants ya tienen los parámetros de CONFIGURACIONES_BASE.');
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
