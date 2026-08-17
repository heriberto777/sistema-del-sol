import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { moduloEstaActivo } from '../../planes/resolver-modulos-activos';
import { REQUIERE_MODULO_KEY } from '../decorators/requiere-modulo.decorator';
import { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Verifica que el tenant actual tenga la clave de módulo declarada con
 * @RequiereModulo('pos') activa, combinando el Plan del tenant con sus
 * excepciones puntuales (TenantModuloOverride) — ver docs/ARCHITECTURE.md,
 * sección "Planes y módulos activables". Registrado globalmente (a
 * diferencia del PluginActiveGuard anterior, que nunca quedó conectado a
 * ningún controller ni como APP_GUARD): sin esto, un módulo nuevo con el
 * decorador pero sin este guard en la cadena simplemente no se protegería.
 */
@Injectable()
export class ModuloActivoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const moduloClave = this.reflector.getAllAndOverride<string>(REQUIERE_MODULO_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!moduloClave) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const tenantId = request.user?.tenantId;
    if (!tenantId) return true; // rutas @Public() sin tenant — no es responsabilidad de este guard

    const activo = await moduloEstaActivo(this.prisma, tenantId, moduloClave);
    if (!activo) {
      throw new ForbiddenException(`El módulo "${moduloClave}" no está activo para este tenant`);
    }
    return true;
  }
}
