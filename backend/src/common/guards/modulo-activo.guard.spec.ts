import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ModuloActivoGuard } from './modulo-activo.guard';
import { PrismaService } from '../../prisma/prisma.service';

function crearContexto(tenantId: string | undefined): ExecutionContext {
  const request = { user: tenantId ? { tenantId } : undefined };
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('ModuloActivoGuard', () => {
  let prisma: { tenantModuloOverride: { findFirst: jest.Mock }; tenant: { findUnique: jest.Mock } };

  function crearGuard(moduloRequerido: string | undefined) {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(moduloRequerido) } as unknown as Reflector;
    return new ModuloActivoGuard(reflector, prisma as unknown as PrismaService);
  }

  beforeEach(() => {
    prisma = {
      tenantModuloOverride: { findFirst: jest.fn().mockResolvedValue(null) },
      tenant: { findUnique: jest.fn() },
    };
  });

  it('permite el acceso si el handler no declara @RequiereModulo', async () => {
    const guard = crearGuard(undefined);
    await expect(guard.canActivate(crearContexto('tenant-1'))).resolves.toBe(true);
  });

  it('permite el acceso en rutas sin tenant (@Public) — no es responsabilidad de este guard', async () => {
    const guard = crearGuard('pos');
    await expect(guard.canActivate(crearContexto(undefined))).resolves.toBe(true);
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('permite el acceso si el módulo está incluido en el plan del tenant', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ plan: { modulos: [{ modulo: { clave: 'pos' } }] } });
    const guard = crearGuard('pos');

    await expect(guard.canActivate(crearContexto('tenant-1'))).resolves.toBe(true);
  });

  it('rechaza si el módulo no está incluido en el plan y no hay excepción', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ plan: { modulos: [{ modulo: { clave: 'facturacion' } }] } });
    const guard = crearGuard('pos');

    await expect(guard.canActivate(crearContexto('tenant-1'))).rejects.toThrow(ForbiddenException);
  });

  it('rechaza si el tenant no tiene ningún plan asignado', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ plan: null });
    const guard = crearGuard('pos');

    await expect(guard.canActivate(crearContexto('tenant-1'))).rejects.toThrow(ForbiddenException);
  });

  it('una excepción activa=true fuerza el acceso aunque el plan no incluya el módulo', async () => {
    prisma.tenantModuloOverride.findFirst.mockResolvedValue({ activo: true });
    const guard = crearGuard('pos');

    await expect(guard.canActivate(crearContexto('tenant-1'))).resolves.toBe(true);
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('una excepción activa=false bloquea el acceso aunque el plan sí incluya el módulo', async () => {
    prisma.tenantModuloOverride.findFirst.mockResolvedValue({ activo: false });
    const guard = crearGuard('pos');

    await expect(guard.canActivate(crearContexto('tenant-1'))).rejects.toThrow(ForbiddenException);
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });
});
