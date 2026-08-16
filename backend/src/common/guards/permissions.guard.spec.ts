import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

function crearContexto(permisosUsuario: string[] | undefined): ExecutionContext {
  const request = { user: permisosUsuario ? { permisos: permisosUsuario } : undefined };
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  function crearGuard(permisosRequeridos: string[] | undefined) {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(permisosRequeridos) } as unknown as Reflector;
    return new PermissionsGuard(reflector);
  }

  it('permite el acceso si el handler no declara @Permissions', () => {
    const guard = crearGuard(undefined);
    expect(guard.canActivate(crearContexto([]))).toBe(true);
  });

  it('permite el acceso si el handler declara un arreglo vacío de permisos', () => {
    const guard = crearGuard([]);
    expect(guard.canActivate(crearContexto([]))).toBe(true);
  });

  it('permite el acceso si el usuario tiene todos los permisos requeridos', () => {
    const guard = crearGuard(['facturacion.crear']);
    expect(guard.canActivate(crearContexto(['facturacion.crear', 'facturacion.ver']))).toBe(true);
  });

  it('rechaza si al usuario le falta alguno de los permisos requeridos', () => {
    const guard = crearGuard(['facturacion.crear', 'admin.configuracion']);
    expect(() => guard.canActivate(crearContexto(['facturacion.crear']))).toThrow(ForbiddenException);
  });

  it('rechaza si el usuario no tiene ningún permiso', () => {
    const guard = crearGuard(['facturacion.ver']);
    expect(() => guard.canActivate(crearContexto(undefined))).toThrow(ForbiddenException);
  });
});
