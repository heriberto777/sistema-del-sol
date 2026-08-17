import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PLATFORM_PERMISSIONS_KEY } from '../decorators/platform-permissions.decorator';
import { AuthenticatedPlatformRequest } from '../../platform-auth/platform-authenticated-request';

@Injectable()
export class PlatformPermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permisosRequeridos = this.reflector.getAllAndOverride<string[]>(PLATFORM_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permisosRequeridos || permisosRequeridos.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedPlatformRequest>();
    const permisosAdmin = new Set(request.user?.permisos ?? []);
    const autorizado = permisosRequeridos.every((permiso) => permisosAdmin.has(permiso));

    if (!autorizado) {
      throw new ForbiddenException(`Requiere el/los permiso(s): ${permisosRequeridos.join(', ')}`);
    }
    return true;
  }
}
