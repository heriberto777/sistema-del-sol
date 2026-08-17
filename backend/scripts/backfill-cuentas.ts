import { PrismaClient } from '@prisma/client';
import { CUENTAS_BASE } from '../src/contabilidad/cuentas-base';

/**
 * Agrega a los tenants YA existentes las cuentas contables que se hayan
 * sumado a CUENTAS_BASE (`src/contabilidad/cuentas-base.ts`) después de que
 * ese tenant fuera provisionado. `TenantsRepository.crearConProvisioning`
 * solo siembra CUENTAS_BASE una vez, al crear el tenant — una cuenta
 * agregada más tarde nunca llega a un tenant ya existente sin este script
 * (mismo problema que ROLES_BASE, ver backfill-permisos.ts).
 *
 * Idempotente: usa el índice único (tenantId, codigo) para solo crear lo
 * que falta, nunca duplica ni pisa cuentas ya existentes.
 *
 * Uso: pnpm --filter ./backend cuentas:backfill
 */
async function main() {
  const prisma = new PrismaClient();

  const tenants = await prisma.tenant.findMany({ select: { id: true, nombre: true } });
  let totalAgregadas = 0;

  for (const tenant of tenants) {
    const existentes = await prisma.cuentaContable.findMany({
      where: { tenantId: tenant.id, codigo: { in: CUENTAS_BASE.map((c) => c.codigo) } },
      select: { codigo: true },
    });
    const codigosExistentes = new Set(existentes.map((c) => c.codigo));
    const faltantes = CUENTAS_BASE.filter((c) => !codigosExistentes.has(c.codigo));
    if (faltantes.length === 0) continue;

    await prisma.cuentaContable.createMany({
      data: faltantes.map((c) => ({
        tenantId: tenant.id,
        codigo: c.codigo,
        nombre: c.nombre,
        tipo: c.tipo,
        naturaleza: c.naturaleza,
      })),
    });

    totalAgregadas += faltantes.length;
    console.log(`${tenant.nombre}: +${faltantes.length} cuenta(s) — ${faltantes.map((c) => c.codigo).join(', ')}`);
  }

  console.log(totalAgregadas > 0 ? `Listo: ${totalAgregadas} cuenta(s) agregada(s) en total.` : 'Nada que agregar — todos los tenants ya tienen las cuentas de CUENTAS_BASE.');
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
