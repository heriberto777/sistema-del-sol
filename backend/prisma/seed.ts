import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PERMISOS_BASE, ROLES_BASE } from '../src/tenants/roles-base';
import { CUENTAS_BASE } from '../src/contabilidad/cuentas-base';

const prisma = new PrismaClient();

async function main() {
  for (const clave of PERMISOS_BASE) {
    await prisma.permission.upsert({
      where: { clave },
      update: {},
      create: { clave },
    });
  }

  const tenant = await prisma.tenant.upsert({
    where: { subdominio: 'demo' },
    update: {},
    create: {
      nombre: 'Empresa Demo',
      subdominio: 'demo',
      settings: { create: {} },
      configuraciones: {
        create: [
          { clave: 'ITBIS_GENERAL', valor: '18' },
          { clave: 'ITBIS_REDUCIDA', valor: '8' },
          { clave: 'PLAZO_PAGO_DIAS', valor: '30' },
          { clave: 'STOCK_MINIMO_DEFAULT', valor: '10' },
        ],
      },
    },
  });

  for (const cuenta of CUENTAS_BASE) {
    await prisma.cuentaContable.upsert({
      where: { tenantId_codigo: { tenantId: tenant.id, codigo: cuenta.codigo } },
      update: {},
      create: { tenantId: tenant.id, codigo: cuenta.codigo, nombre: cuenta.nombre, tipo: cuenta.tipo, naturaleza: cuenta.naturaleza },
    });
  }

  for (const [nombreRol, permisos] of Object.entries(ROLES_BASE)) {
    const role = await prisma.role.upsert({
      where: { tenantId_nombre: { tenantId: tenant.id, nombre: nombreRol } },
      update: {},
      create: { tenantId: tenant.id, nombre: nombreRol, esSistema: true },
    });

    for (const clave of permisos) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { clave } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  const adminRole = await prisma.role.findFirstOrThrow({
    where: { tenantId: tenant.id, nombre: 'Admin Total' },
  });

  const passwordHash = await bcrypt.hash('Admin123!', 10);
  const adminUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@demo.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@demo.com',
      nombre: 'Administrador Demo',
      passwordHash,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id },
  });

  const unAnioDespues = new Date();
  unAnioDespues.setFullYear(unAnioDespues.getFullYear() + 1);

  for (const tipoNcf of ['B01', 'B02', 'B03', 'B04'] as const) {
    await prisma.ncfAsignado.upsert({
      where: { tenantId_tipoNcf: { tenantId: tenant.id, tipoNcf } },
      update: {},
      create: {
        tenantId: tenant.id,
        tipoNcf,
        secuenciaActual: 1,
        secuenciaFinal: 50_000_000,
        vigenciaHasta: unAnioDespues,
      },
    });
  }

  const bodega = await prisma.bodega.upsert({
    where: { tenantId_nombre: { tenantId: tenant.id, nombre: 'Principal' } },
    update: {},
    create: { tenantId: tenant.id, nombre: 'Principal' },
  });

  const producto = await prisma.producto.upsert({
    where: { tenantId_codigo: { tenantId: tenant.id, codigo: 'DEMO-001' } },
    update: {},
    create: {
      tenantId: tenant.id,
      codigo: 'DEMO-001',
      nombre: 'Producto de demostración',
      porcentajeItbis: 18,
    },
  });

  // Todo producto tiene siempre al menos una variante "por defecto" (Fase
  // 3c) — Stock/Precio cuelgan de ella, nunca directo del producto.
  const varianteDefault =
    (await prisma.varianteProducto.findFirst({ where: { productoId: producto.id } })) ??
    (await prisma.varianteProducto.create({ data: { tenantId: tenant.id, productoId: producto.id } }));

  const precioVigente = await prisma.precio.findFirst({
    where: { varianteId: varianteDefault.id, listaPrecio: 'GENERAL', vigenteHasta: null },
  });
  if (!precioVigente) {
    await prisma.precio.create({
      data: { varianteId: varianteDefault.id, listaPrecio: 'GENERAL', costo: 100, margenPct: 50, precioVenta: 150 },
    });
  }

  await prisma.stock.upsert({
    where: { varianteId_bodegaId: { varianteId: varianteDefault.id, bodegaId: bodega.id } },
    update: {},
    create: { varianteId: varianteDefault.id, bodegaId: bodega.id, cantidadActual: 100, stockMinimo: 10 },
  });

  await prisma.empleado.upsert({
    where: { tenantId_cedula: { tenantId: tenant.id, cedula: '001-0000000-1' } },
    update: {},
    create: {
      tenantId: tenant.id,
      nombre: 'Empleado de Demostración',
      cedula: '001-0000000-1',
      cargo: 'Asistente Administrativo',
      fechaIngreso: new Date('2024-01-15'),
      salarioBrutoMensual: 35000,
    },
  });

  console.log(`Seed listo. Tenant "demo" — admin@demo.com / Admin123!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
