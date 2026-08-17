import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformPermissionsGuard } from './platform-permissions.guard';

function crearContexto(permisosAdmin: string[] | undefined): ExecutionContext {
  const request = { user: permisosAdmin ? { permisos: permisosAdmin } : undefined };
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('PlatformPermissionsGuard', () => {
  function crearGuard(permisosRequeridos: string[] | undefined) {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(permisosRequeridos) } as unknown as Reflector;
    return new PlatformPermissionsGuard(reflector);
  }

  it('permite el acceso si el handler no declara @PlatformPermissions', () => {
    const guard = crearGuard(undefined);
    expect(guard.canActivate(crearContexto([]))).toBe(true);
  });

  it('permite el acceso si el handler declara un arreglo vacío de permisos', () => {
    const guard = crearGuard([]);
    expect(guard.canActivate(crearContexto([]))).toBe(true);
  });

  it('permite el acceso si el admin tiene todos los permisos requeridos', () => {
    const guard = crearGuard(['platform.tenants.ver']);
    expect(guard.canActivate(crearContexto(['platform.tenants.ver', 'platform.planes.ver']))).toBe(true);
  });

  it('rechaza si al admin le falta alguno de los permisos requeridos', () => {
    const guard = crearGuard(['platform.tenants.ver', 'platform.admins.gestionar']);
    expect(() => guard.canActivate(crearContexto(['platform.tenants.ver']))).toThrow(ForbiddenException);
  });

  it('rechaza si el admin no tiene rol (sin permisos)', () => {
    const guard = crearGuard(['platform.tenants.ver']);
    expect(() => guard.canActivate(crearContexto(undefined))).toThrow(ForbiddenException);
  });
});
