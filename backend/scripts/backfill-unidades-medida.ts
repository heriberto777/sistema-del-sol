import { PrismaClient } from '@prisma/client';
import { UNIDADES_MEDIDA_BASE } from '../src/tenants/unidades-medida-base';

/**
 * Conversión de unidades de medida — opt-in, igual criterio que
 * controlaVencimiento. Dos pasos, uno por cada cosa que un tenant existente
 * no tiene y que de otro modo solo le llegaría a tenants nuevos (ver
 * TenantsRepository.crearConProvisioning):
 *
 * 1. Siembra el catálogo UNIDADES_MEDIDA_BASE (UND/CAJA/DOC/LB/KG/LT) para
 *    cada tenant que todavía no lo tenga — `skipDuplicates` lo hace
 *    idempotente.
 * 2. Para cada Producto sin unidadMedidaBaseId, busca (o crea) en el
 *    catálogo del tenant una UnidadMedida cuyo código coincida con su
 *    `unidadMedida` de texto libre actual (ej. "KILOGRAMO", "DOCENA") y lo
 *    vincula — así un producto existente arranca con una unidad base
 *    coherente con lo que ya tenía, sin forzar una re-captura manual. No
 *    agrega ninguna unidadesConversion — eso es una decisión explícita del
 *    admin del tenant (empaque de compra/venta), no algo que se pueda
 *    inferir de datos viejos.
 *
 * Uso: pnpm --filter ./backend unidades-medida:backfill
 */
async function main() {
  const prisma = new PrismaClient();

  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  let tenantsSembrados = 0;
  for (const tenant of tenants) {
    const resultado = await prisma.unidadMedida.createMany({
      data: UNIDADES_MEDIDA_BASE.map((u) => ({ tenantId: tenant.id, ...u })),
      skipDuplicates: true,
    });
    if (resultado.count > 0) tenantsSembrados++;
  }

  const productos = await prisma.producto.findMany({
    where: { unidadMedidaBaseId: null },
    select: { id: true, tenantId: true, unidadMedida: true },
  });

  const cache = new Map<string, string>();
  let productosVinculados = 0;

  for (const producto of productos) {
    const codigo = producto.unidadMedida || 'UND';
    const cacheKey = `${producto.tenantId}:${codigo}`;
    let unidadId = cache.get(cacheKey);

    if (!unidadId) {
      const existente = await prisma.unidadMedida.findUnique({
        where: { tenantId_codigo: { tenantId: producto.tenantId, codigo } },
      });
      const unidad =
        existente ??
        (await prisma.unidadMedida.create({
          data: { tenantId: producto.tenantId, codigo, nombre: codigo.charAt(0) + codigo.slice(1).toLowerCase() },
        }));
      unidadId = unidad.id;
      cache.set(cacheKey, unidadId);
    }

    await prisma.producto.update({ where: { id: producto.id }, data: { unidadMedidaBaseId: unidadId } });
    productosVinculados++;
  }

  console.log(`Listo: ${tenantsSembrados} tenant(s) sembrados con el catálogo base de UnidadMedida.`);
  console.log(`${productosVinculados} producto(s) vinculados a su UnidadMedida base a partir de su unidadMedida de texto libre.`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
