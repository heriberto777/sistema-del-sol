import { PrismaClient } from '@prisma/client';
import { ROLES_BASE } from '../src/tenants/roles-base';

/**
 * Migración puntual: separa el rol Vendedor (antes hacía de todo) en
 * Vendedor (cotizaciones/remisiones, sin POS) + Cajero (solo POS) +
 * Supervisor de Caja (Cajero + pos.supervisar) — ver
 * docs/ARCHITECTURE.md, "Roles de POS: Cajero, Vendedor, Supervisor de
 * Caja". `permisos:backfill` es aditivo y solo AGREGA permisos a roles
 * que ya existen — no crea roles nuevos ni quita permisos, así que esta
 * migración de tenants ya provisionados necesita un script separado:
 *
 * 1. Crea "Cajero" y "Supervisor de Caja" en cada tenant si no existen.
 * 2. A cada usuario que hoy tiene el rol Vendedor, le suma el rol Cajero
 *    (para que no pierda acceso al POS que ya tenía).
 * 3. Le quita a Vendedor los permisos que ya no le corresponden
 *    (facturacion.anular/imprimir, pos.ver/editar).
 *
 * Idempotente: cada paso revisa el estado actual antes de actuar.
 *
 * Uso: pnpm --filter ./backend migrar-roles-pos
 */
const ROLES_NUEVOS = ['Cajero', 'Supervisor de Caja'];
const PERMISOS_A_QUITAR_DE_VENDEDOR = ['facturacion.anular', 'facturacion.imprimir', 'pos.ver', 'pos.editar'];

async function main() {
  const prisma = new PrismaClient();

  const tenants = await prisma.tenant.findMany({ select: { id: true, nombre: true } });
  let rolesCreados = 0;
  let usuariosMigrados = 0;
  let permisosQuitados = 0;

  for (const tenant of tenants) {
    // 1. Crear los roles nuevos si no existen.
    const cajeroExistente = await prisma.role.findUnique({
      where: { tenantId_nombre: { tenantId: tenant.id, nombre: 'Cajero' } },
    });
    for (const nombreRol of ROLES_NUEVOS) {
      const yaExiste = await prisma.role.findUnique({ where: { tenantId_nombre: { tenantId: tenant.id, nombre: nombreRol } } });
      if (yaExiste) continue;

      const rol = await prisma.role.create({ data: { tenantId: tenant.id, nombre: nombreRol, esSistema: true } });
      for (const clave of ROLES_BASE[nombreRol]) {
        const permiso = await prisma.permission.findUniqueOrThrow({ where: { clave } });
        await prisma.rolePermission.create({ data: { roleId: rol.id, permissionId: permiso.id } });
      }
      rolesCreados += 1;
      console.log(`${tenant.nombre}: rol "${nombreRol}" creado.`);
    }

    // 2. Migrar usuarios de Vendedor -> también Cajero (para no perder acceso a POS).
    const rolVendedor = await prisma.role.findUnique({
      where: { tenantId_nombre: { tenantId: tenant.id, nombre: 'Vendedor' } },
      include: { permisos: true, rolePermissions: { include: { permission: true } } },
    });
    if (rolVendedor) {
      const rolCajero =
        cajeroExistente ??
        (await prisma.role.findUniqueOrThrow({ where: { tenantId_nombre: { tenantId: tenant.id, nombre: 'Cajero' } } }));

      const usuariosVendedor = rolVendedor.permisos; // UserRole[] de este rol
      for (const userRole of usuariosVendedor) {
        const yaTieneCajero = await prisma.userRole.findUnique({
          where: { userId_roleId: { userId: userRole.userId, roleId: rolCajero.id } },
        });
        if (yaTieneCajero) continue;
        await prisma.userRole.create({ data: { userId: userRole.userId, roleId: rolCajero.id } });
        usuariosMigrados += 1;
        console.log(`${tenant.nombre}: usuario ${userRole.userId} sumó el rol Cajero (tenía Vendedor).`);
      }

      // 3. Quitarle a Vendedor los permisos que ya no le corresponden.
      const aQuitar = rolVendedor.rolePermissions.filter((rp) => PERMISOS_A_QUITAR_DE_VENDEDOR.includes(rp.permission.clave));
      if (aQuitar.length > 0) {
        await prisma.rolePermission.deleteMany({
          where: { roleId: rolVendedor.id, permissionId: { in: aQuitar.map((rp) => rp.permissionId) } },
        });
        permisosQuitados += aQuitar.length;
        console.log(`${tenant.nombre} / Vendedor: -${aQuitar.length} permiso(s) — ${aQuitar.map((rp) => rp.permission.clave).join(', ')}`);
      }
    }
  }

  console.log(`Listo: ${rolesCreados} rol(es) creado(s), ${usuariosMigrados} usuario(s) migrado(s) a Cajero, ${permisosQuitados} permiso(s) quitado(s) de Vendedor.`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
