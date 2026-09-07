import { PrismaClient } from '@prisma/client';
import { CORRELATIVOS_BASE } from '../src/tenants/correlativos-base';

/**
 * A cualquier tenant creado antes de esta feature (todos los existentes,
 * ej. "demo") le crea las filas de Correlativo que le falten, con los
 * defaults de fábrica (sin prefijo, arranca en 1, 5 dígitos) — mismos
 * defaults que TenantsRepository.crearConProvisioning siembra para
 * tenants nuevos. FACTURA se sumó después (ver
 * backfill-numero-facturas.ts para asignarle número a facturas ya
 * existentes).
 *
 * Lee `CORRELATIVOS_BASE` en vez de tener su propia lista copiada — antes
 * tenía un array hardcodeado acá que quedó desactualizado (le faltaban
 * CONTEO_FISICO/CODIGO_BARRAS, agregados en una sesión posterior sin
 * tocar este script) — mismo criterio que backfill-configuraciones.ts ya
 * usa contra CONFIGURACIONES_BASE, para que la próxima vez que se agregue
 * un TipoCorrelativo nuevo, este script lo recoja solo.
 *
 * Nota: aunque `CorrelativosRepository.siguienteEnTx` ya crea la fila
 * sola con los defaults si no existe (autosanación en el primer uso),
 * correr este backfill sirve para que la fila aparezca desde ya en
 * Admin → Consecutivos sin esperar al primer uso real.
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
    const faltantes = CORRELATIVOS_BASE.filter((tipo) => !tiposExistentes.has(tipo));
    if (faltantes.length === 0) continue;

    await prisma.correlativo.createMany({
      data: faltantes.map((tipo) => ({ tenantId: tenant.id, tipo })),
    });
    creadas += faltantes.length;
    console.log(`${faltantes.length} correlativo(s) creado(s) para "${tenant.nombre}" (${faltantes.join(', ')})`);
  }

  console.log(
    creadas > 0
      ? `Listo: ${creadas} correlativo(s) creado(s) en total.`
      : `Nada que hacer — todos los tenants ya tienen sus ${CORRELATIVOS_BASE.length} correlativos.`,
  );
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
