import { resolverModulosActivos, resolverModulosConOrigen } from './resolver-modulos-activos';
import { PrismaService } from '../prisma/prisma.service';

describe('resolverModulosActivos', () => {
  let prisma: { tenant: { findUnique: jest.Mock }; tenantModuloOverride: { findMany: jest.Mock }; modulo: { findMany: jest.Mock } };

  beforeEach(() => {
    prisma = {
      tenant: { findUnique: jest.fn() },
      tenantModuloOverride: { findMany: jest.fn().mockResolvedValue([]) },
      modulo: { findMany: jest.fn().mockResolvedValue([]) },
    };
  });

  it('devuelve los módulos del plan si no hay ninguna excepción', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      plan: { modulos: [{ modulo: { clave: 'pos' } }, { modulo: { clave: 'nomina' } }] },
    });

    const resultado = await resolverModulosActivos(prisma as unknown as PrismaService, 'tenant-1');

    expect(new Set(resultado)).toEqual(new Set(['pos', 'nomina']));
  });

  it('una excepción activa=true agrega un módulo que el plan no incluía', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ plan: { modulos: [{ modulo: { clave: 'facturacion' } }] } });
    prisma.tenantModuloOverride.findMany.mockResolvedValue([{ activo: true, modulo: { clave: 'pos' } }]);

    const resultado = await resolverModulosActivos(prisma as unknown as PrismaService, 'tenant-1');

    expect(new Set(resultado)).toEqual(new Set(['facturacion', 'pos']));
  });

  it('una excepción activa=false quita un módulo que el plan sí incluía', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      plan: { modulos: [{ modulo: { clave: 'facturacion' } }, { modulo: { clave: 'pos' } }] },
    });
    prisma.tenantModuloOverride.findMany.mockResolvedValue([{ activo: false, modulo: { clave: 'pos' } }]);

    const resultado = await resolverModulosActivos(prisma as unknown as PrismaService, 'tenant-1');

    expect(resultado).toEqual(['facturacion']);
  });

  it('devuelve una lista vacía si el tenant no tiene plan asignado', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ plan: null });

    const resultado = await resolverModulosActivos(prisma as unknown as PrismaService, 'tenant-1');

    expect(resultado).toEqual([]);
  });
});

describe('resolverModulosConOrigen', () => {
  let prisma: {
    tenant: { findUnique: jest.Mock };
    tenantModuloOverride: { findMany: jest.Mock };
    modulo: { findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      tenant: { findUnique: jest.fn() },
      tenantModuloOverride: { findMany: jest.fn().mockResolvedValue([]) },
      modulo: { findMany: jest.fn() },
    };
  });

  it('marca origen "plan" para un módulo incluido en el plan sin excepción', async () => {
    prisma.modulo.findMany.mockResolvedValue([{ clave: 'pos', nombre: 'Punto de venta' }]);
    prisma.tenant.findUnique.mockResolvedValue({ plan: { modulos: [{ modulo: { clave: 'pos' } }] } });

    const resultado = await resolverModulosConOrigen(prisma as unknown as PrismaService, 'tenant-1');

    expect(resultado).toEqual([{ clave: 'pos', nombre: 'Punto de venta', activo: true, origen: 'plan' }]);
  });

  it('marca origen "override" y respeta su valor por encima del plan', async () => {
    prisma.modulo.findMany.mockResolvedValue([{ clave: 'pos', nombre: 'Punto de venta' }]);
    prisma.tenant.findUnique.mockResolvedValue({ plan: { modulos: [] } }); // el plan NO lo incluye
    prisma.tenantModuloOverride.findMany.mockResolvedValue([{ activo: true, modulo: { clave: 'pos' } }]);

    const resultado = await resolverModulosConOrigen(prisma as unknown as PrismaService, 'tenant-1');

    expect(resultado).toEqual([{ clave: 'pos', nombre: 'Punto de venta', activo: true, origen: 'override' }]);
  });

  it('incluye TODO el catálogo, no solo los activos', async () => {
    prisma.modulo.findMany.mockResolvedValue([
      { clave: 'facturacion', nombre: 'Facturación' },
      { clave: 'nomina', nombre: 'Nómina' },
    ]);
    prisma.tenant.findUnique.mockResolvedValue({ plan: { modulos: [{ modulo: { clave: 'facturacion' } }] } });

    const resultado = await resolverModulosConOrigen(prisma as unknown as PrismaService, 'tenant-1');

    expect(resultado).toEqual([
      { clave: 'facturacion', nombre: 'Facturación', activo: true, origen: 'plan' },
      { clave: 'nomina', nombre: 'Nómina', activo: false, origen: 'plan' },
    ]);
  });
});
