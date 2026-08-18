import { PrismaClient } from '@prisma/client';

/**
 * Migración puntual: el rol Vendedor deja de poder crear/ver/cobrar
 * facturas desde la pantalla de Facturación — su única pantalla de
 * venta pasa a ser el POS (ver docs/ARCHITECTURE.md, "Vendedor solo
 * vende por POS"). `permisos:backfill` es deliberadamente aditivo
 * (nunca borra), así que quitarle a Vendedor lo que ya no debe tener en
 * tenants ya provisionados necesita este script separado.
 *
 * Idempotente: solo borra las filas de RolePermission que existan.
 *
 * Uso: pnpm --filter ./backend ajustar-permisos-vendedor:migrar
 */
async function main() {
  const prisma = new PrismaClient();
  const A_QUITAR = ['facturacion.crear', 'facturacion.ver', 'facturacion.cobrar'];

  const roles = await prisma.role.findMany({
    where: { nombre: 'Vendedor' },
    include: { rolePermissions: { include: { permission: true } } },
  });

  let totalQuitados = 0;
  for (const rol of roles) {
    const aQuitar = rol.rolePermissions.filter((rp) => A_QUITAR.includes(rp.permission.clave));
    if (aQuitar.length === 0) continue;

    await prisma.rolePermission.deleteMany({
      where: { roleId: rol.id, permissionId: { in: aQuitar.map((rp) => rp.permissionId) } },
    });
    totalQuitados += aQuitar.length;
    console.log(`Tenant ${rol.tenantId} / Vendedor: -${aQuitar.length} permiso(s) — ${aQuitar.map((rp) => rp.permission.clave).join(', ')}`);
  }

  console.log(totalQuitados > 0 ? `Listo: ${totalQuitados} permiso(s) quitado(s) en total.` : 'Nada que quitar — ningún Vendedor tenía esos permisos.');
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
