import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PluginActiveGuard } from './plugin-active.guard';
import { PrismaService } from '../../prisma/prisma.service';

function crearContexto(tenantId = 'tenant-1'): ExecutionContext {
  const request = { user: { tenantId } };
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('PluginActiveGuard', () => {
  function crearGuard(pluginKeyRequerido: string | undefined, tenantPluginEncontrado: unknown) {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(pluginKeyRequerido) } as unknown as Reflector;
    const prisma = {
      tenantPlugin: { findUnique: jest.fn().mockResolvedValue(tenantPluginEncontrado) },
    } as unknown as PrismaService;
    return { guard: new PluginActiveGuard(reflector, prisma), prisma };
  }

  it('permite el acceso si el handler no declara @RequiresPlugin', async () => {
    const { guard } = crearGuard(undefined, null);
    await expect(guard.canActivate(crearContexto())).resolves.toBe(true);
  });

  it('permite el acceso si el plugin está activo para el tenant', async () => {
    const { guard } = crearGuard('inmobiliaria', { activo: true });
    await expect(guard.canActivate(crearContexto())).resolves.toBe(true);
  });

  it('rechaza si el plugin existe pero está inactivo', async () => {
    const { guard } = crearGuard('inmobiliaria', { activo: false });
    await expect(guard.canActivate(crearContexto())).rejects.toThrow(ForbiddenException);
  });

  it('rechaza si el tenant nunca instaló/activó el plugin', async () => {
    const { guard } = crearGuard('inmobiliaria', null);
    await expect(guard.canActivate(crearContexto())).rejects.toThrow(ForbiddenException);
  });

  it('consulta tenantPlugin con el tenantId del usuario autenticado y el pluginKey pedido', async () => {
    const { guard, prisma } = crearGuard('inmobiliaria', { activo: true });
    await guard.canActivate(crearContexto('tenant-xyz'));
    expect(prisma.tenantPlugin.findUnique).toHaveBeenCalledWith({
      where: { tenantId_pluginKey: { tenantId: 'tenant-xyz', pluginKey: 'inmobiliaria' } },
    });
  });
});
