import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { CrearTenantDto } from './dto/crear-tenant.dto';
import { ActualizarTenantDto } from './dto/actualizar-tenant.dto';
import { Public } from '../common/decorators/public.decorator';
import { PlatformAuthGuard } from '../platform-auth/guards/platform-auth.guard';

@ApiBearerAuth()
@ApiTags('platform-tenants')
@Public() // el JwtAuthGuard global de tenants no debe intervenir aquí
@UseGuards(PlatformAuthGuard)
@Controller('platform/tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  crear(@Body() dto: CrearTenantDto) {
    return this.tenantsService.crear(dto);
  }

  @Get()
  listar() {
    return this.tenantsService.listar();
  }

  @Get(':id')
  buscarPorId(@Param('id') id: string) {
    return this.tenantsService.buscarPorId(id);
  }

  @Patch(':id')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarTenantDto) {
    return this.tenantsService.actualizar(id, dto);
  }
}
