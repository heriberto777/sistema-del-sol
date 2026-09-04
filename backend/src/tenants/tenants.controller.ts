import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { TenantDominiosService } from './tenant-dominios.service';
import { CrearTenantDto } from './dto/crear-tenant.dto';
import { ActualizarTenantDto } from './dto/actualizar-tenant.dto';
import { AgregarTenantDominioDto } from './dto/agregar-tenant-dominio.dto';
import { Public } from '../common/decorators/public.decorator';
import { PlatformPermissions } from '../common/decorators/platform-permissions.decorator';
import { PlatformAuthGuard } from '../platform-auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../common/guards/platform-permissions.guard';

@ApiBearerAuth()
@ApiTags('platform-tenants')
@Public() // el JwtAuthGuard global de tenants no debe intervenir aquí
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/tenants')
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly tenantDominiosService: TenantDominiosService,
  ) {}

  @Post()
  @PlatformPermissions('platform.tenants.crear')
  crear(@Body() dto: CrearTenantDto) {
    return this.tenantsService.crear(dto);
  }

  @Get()
  @PlatformPermissions('platform.tenants.ver')
  listar() {
    return this.tenantsService.listar();
  }

  @Get(':id')
  @PlatformPermissions('platform.tenants.ver')
  buscarPorId(@Param('id') id: string) {
    return this.tenantsService.buscarPorId(id);
  }

  @Patch(':id')
  @PlatformPermissions('platform.tenants.gestionar')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarTenantDto) {
    return this.tenantsService.actualizar(id, dto);
  }

  @Get(':id/dominios')
  @PlatformPermissions('platform.tenants.dominios.gestionar')
  listarDominios(@Param('id') id: string) {
    return this.tenantDominiosService.listar(id);
  }

  @Post(':id/dominios')
  @PlatformPermissions('platform.tenants.dominios.gestionar')
  agregarDominio(@Param('id') id: string, @Body() dto: AgregarTenantDominioDto) {
    return this.tenantDominiosService.agregar(id, dto.dominio);
  }

  @Post(':id/dominios/:dominioId/verificar')
  @PlatformPermissions('platform.tenants.dominios.gestionar')
  verificarDominio(@Param('dominioId') dominioId: string) {
    return this.tenantDominiosService.verificarYActivar(dominioId);
  }

  @Delete(':id/dominios/:dominioId')
  @PlatformPermissions('platform.tenants.dominios.gestionar')
  eliminarDominio(@Param('dominioId') dominioId: string) {
    return this.tenantDominiosService.eliminar(dominioId);
  }
}
