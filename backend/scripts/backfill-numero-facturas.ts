import { PrismaClient } from '@prisma/client';

const CORRELATIVO_DEFAULT = { prefijo: '', digitos: 5, siguienteNumero: 1 };

/**
 * Asigna `numero` (ítem "consistencia visual de Ventas", número interno
 * de Factura — ver docs/ARCHITECTURE.md) a las facturas creadas ANTES de
 * esa columna, que quedan con `numero: null` (fallback a NCF/id en el
 * frontend hasta que se corra esto). Ordena por `fecha` ascendente
 * dentro de cada tenant y consume el mismo `Correlativo` (tipo
 * `FACTURA`) que ya usan las facturas nuevas — si el tenant no tiene esa
 * fila todavía (creado antes de `correlativos:backfill`), la crea acá
 * con los defaults de fábrica.
 *
 * No bloqueante: una factura vieja sin `numero` simplemente se sigue
 * mostrando por NCF/id hasta que esto se corra — no hace falta correrlo
 * antes de desplegar la feature.
 *
 * Uso: pnpm --filter ./backend facturas:backfill-numero
 */
async function main() {
  const prisma = new PrismaClient();

  const tenants = await prisma.tenant.findMany({ select: { id: true, nombre: true } });
  let totalAsignadas = 0;

  for (const tenant of tenants) {
    const facturas = await prisma.factura.findMany({
      where: { tenantId: tenant.id, numero: null },
      select: { id: true },
      orderBy: { fecha: 'asc' },
    });
    if (facturas.length === 0) continue;

    const correlativo =
      (await prisma.correlativo.findFirst({ where: { tenantId: tenant.id, tipo: 'FACTURA' } })) ??
      (await prisma.correlativo.create({ data: { tenantId: tenant.id, tipo: 'FACTURA', ...CORRELATIVO_DEFAULT } }));

    let siguiente = correlativo.siguienteNumero;
    for (const factura of facturas) {
      const numero = `${correlativo.prefijo}${String(siguiente).padStart(correlativo.digitos, '0')}`;
      await prisma.factura.update({ where: { id: factura.id }, data: { numero } });
      siguiente += 1;
    }
    await prisma.correlativo.update({ where: { id: correlativo.id }, data: { siguienteNumero: siguiente } });

    totalAsignadas += facturas.length;
    console.log(`${facturas.length} factura(s) numeradas para "${tenant.nombre}" (próximo número: ${siguiente}).`);
  }

  console.log(totalAsignadas > 0 ? `Listo: ${totalAsignadas} factura(s) numeradas en total.` : 'Nada que hacer — todas las facturas ya tienen número.');
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
