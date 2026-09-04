import { Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TenantDominiosRepository } from './tenant-dominios.repository';
import { Public } from '../common/decorators/public.decorator';

/**
 * Sin sesión, a propósito separado del resto de endpoints de dominios
 * (que llevan PlatformAuthGuard/PlatformPermissionsGuard) — el frontend
 * lo consulta ANTES de saber a qué tenant pertenece un hostname que no es
 * `*.ciguadev.com`, para decidir si monta la SPA de tienda o la de admin
 * (ver resolverContextoTienda() en router.tsx).
 */
@ApiTags('tenants-dominio-publico')
@Public()
@Controller('tenants/resolver-por-dominio')
export class TenantDominiosPublicaController {
  constructor(private readonly repo: TenantDominiosRepository) {}

  @Get()
  async resolver(@Query('host') host?: string) {
    const dominio = (host ?? '').trim().toLowerCase();
    const registro = dominio ? await this.repo.buscarActivoPorDominio(dominio) : null;
    if (!registro) throw new NotFoundException('No hay ningún tenant activo con ese dominio');
    return { subdominio: registro.tenant.subdominio };
  }
}
