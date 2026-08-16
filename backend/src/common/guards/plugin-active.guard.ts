import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { REQUIRES_PLUGIN_KEY } from '../decorators/requires-plugin.decorator';
import { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Verifica que el tenant actual tenga instalado y activo el plugin
 * declarado con @RequiresPlugin('inmobiliaria') en el controller/handler.
 * La instalación del plugin en sí (código) es manual vía git/deploy;
 * este guard solo controla la activación por tenant en runtime.
 */
@Injectable()
export class PluginActiveGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const pluginKey = this.reflector.getAllAndOverride<string>(REQUIRES_PLUGIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!pluginKey) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const tenantPlugin = await this.prisma.tenantPlugin.findUnique({
      where: { tenantId_pluginKey: { tenantId: request.user.tenantId, pluginKey } },
    });

    if (!tenantPlugin?.activo) {
      throw new ForbiddenException(`El plugin "${pluginKey}" no está activo para este tenant`);
    }
    return true;
  }
}
