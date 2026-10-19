import { PrismaClient } from '@prisma/client';

/**
 * Motor de costeo (Promedio Ponderado) — el stock que ya existía antes de
 * esta columna no tiene ningún historial de compras del que calcular un
 * costo real. Aproximación explícita, decisión del usuario: sembrar
 * `Stock.costoPromedio` desde `Precio.costo` (lista GENERAL vigente) de
 * esa variante cuando exista — es el costo que YA se usaba para calcular
 * margen de venta, mejor aproximación disponible sin inventar un número.
 * Sin precio GENERAL vigente, queda en 0 (log aparte, para revisar a mano).
 *
 * Solo toca filas con `costoPromedio: 0` y `cantidadActual > 0` — no tiene
 * sentido "valorizar" stock en cero, y es idempotente (correrlo de nuevo
 * no vuelve a tocar lo que ya se backfilleó, salvo que alguien lo haya
 * reseteado a mano a 0 otra vez).
 *
 * Uso: pnpm --filter ./backend costo-promedio:backfill
 */
async function main() {
  const prisma = new PrismaClient();

  const stocks = await prisma.stock.findMany({
    where: { costoPromedio: 0, cantidadActual: { gt: 0 } },
    select: { id: true, varianteId: true },
  });

  let actualizados = 0;
  let sinPrecio = 0;

  for (const stock of stocks) {
    const precio = await prisma.precio.findFirst({
      where: { varianteId: stock.varianteId, listaPrecio: 'GENERAL', vigenteHasta: null },
      select: { costo: true },
    });

    if (!precio) {
      sinPrecio++;
      continue;
    }

    await prisma.stock.update({ where: { id: stock.id }, data: { costoPromedio: precio.costo } });
    actualizados++;
  }

  console.log(`Listo: ${actualizados} fila(s) de Stock con costoPromedio sembrado desde Precio.costo.`);
  if (sinPrecio > 0) {
    console.log(`${sinPrecio} fila(s) quedaron en costoPromedio: 0 — esa variante no tiene un Precio GENERAL vigente del cual aproximar (revisar a mano si hace falta).`);
  }
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
