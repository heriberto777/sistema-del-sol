import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TenantEmpresaService } from './tenant-empresa.service';
import { ActualizarTenantEmpresaDto } from './dto/actualizar-tenant-empresa.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

/** Ítem "e-CF real" (pieza 1) — datos del emisor que cada tenant edita self-service, obligatorios para el `sender` de Alanube (piezas 2/3). */
@ApiBearerAuth()
@ApiTags('admin-empresa')
@Controller('admin/empresa')
export class TenantEmpresaController {
  constructor(private readonly tenantEmpresaService: TenantEmpresaService) {}

  @Get()
  @Permissions('admin.configuracion')
  obtener(@CurrentUser() user: JwtPayloadUser) {
    return this.tenantEmpresaService.obtener(user.tenantId);
  }

  @Patch()
  @Permissions('admin.configuracion')
  actualizar(@Body() dto: ActualizarTenantEmpresaDto, @CurrentUser() user: JwtPayloadUser) {
    return this.tenantEmpresaService.actualizar(user.tenantId, dto);
  }
}
