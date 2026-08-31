import { PrismaClient, TipoCorrelativo } from '@prisma/client';

const TIPOS: TipoCorrelativo[] = ['COTIZACION', 'REMISION', 'ORDEN_COMPRA', 'CAJA', 'PRODUCTO', 'CUENTA_CONTABLE', 'FACTURA', 'AJUSTE'];

/**
 * A cualquier tenant creado antes de esta feature (todos los existentes,
 * ej. "demo") le crea las 7 filas de Correlativo que le falten, con los
 * defaults de fábrica (sin prefijo, arranca en 1, 5 dígitos) — mismos
 * defaults que TenantsRepository.crearConProvisioning siembra para
 * tenants nuevos. FACTURA se sumó después (ver
 * backfill-numero-facturas.ts para asignarle número a facturas ya
 * existentes).
 *
 * Idempotente: solo crea las filas (tenantId, tipo) que todavía no existan.
 *
 * Uso: pnpm --filter ./backend correlativos:backfill
 */
async function main() {
  const prisma = new PrismaClient();

  const tenants = await prisma.tenant.findMany({ select: { id: true, nombre: true } });
  let creadas = 0;

  for (const tenant of tenants) {
    const existentes = await prisma.correlativo.findMany({ where: { tenantId: tenant.id }, select: { tipo: true } });
    const tiposExistentes = new Set(existentes.map((c) => c.tipo));
    const faltantes = TIPOS.filter((tipo) => !tiposExistentes.has(tipo));
    if (faltantes.length === 0) continue;

    await prisma.correlativo.createMany({
      data: faltantes.map((tipo) => ({ tenantId: tenant.id, tipo })),
    });
    creadas += faltantes.length;
    console.log(`${faltantes.length} correlativo(s) creado(s) para "${tenant.nombre}" (${faltantes.join(', ')})`);
  }

  console.log(
    creadas > 0 ? `Listo: ${creadas} correlativo(s) creado(s) en total.` : `Nada que hacer — todos los tenants ya tienen sus ${TIPOS.length} correlativos.`,
  );
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
