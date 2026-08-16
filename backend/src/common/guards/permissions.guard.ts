import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AuthenticatedRequest } from '../types/authenticated-request';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permisosRequeridos = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permisosRequeridos || permisosRequeridos.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const permisosUsuario = new Set(request.user?.permisos ?? []);
    const autorizado = permisosRequeridos.every((permiso) => permisosUsuario.has(permiso));

    if (!autorizado) {
      throw new ForbiddenException(
        `Requiere el/los permiso(s): ${permisosRequeridos.join(', ')}`,
      );
    }
    return true;
  }
}
