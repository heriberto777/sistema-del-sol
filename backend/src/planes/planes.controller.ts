import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlanesService } from './planes.service';
import { CrearPlanDto } from './dto/crear-plan.dto';
import { ActualizarPlanDto } from './dto/actualizar-plan.dto';
import { Public } from '../common/decorators/public.decorator';
import { PlatformPermissions } from '../common/decorators/platform-permissions.decorator';
import { PlatformAuthGuard } from '../platform-auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../common/guards/platform-permissions.guard';

@ApiBearerAuth()
@ApiTags('platform-planes')
@Public() // el JwtAuthGuard global de tenants no debe intervenir aquí
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/planes')
export class PlanesController {
  constructor(private readonly planesService: PlanesService) {}

  @Get('modulos')
  @PlatformPermissions('platform.planes.ver')
  listarModulos() {
    return this.planesService.listarModulos();
  }

  @Get()
  @PlatformPermissions('platform.planes.ver')
  listar() {
    return this.planesService.listar();
  }

  @Get(':id')
  @PlatformPermissions('platform.planes.ver')
  buscarPorId(@Param('id') id: string) {
    return this.planesService.buscarPorId(id);
  }

  @Post()
  @PlatformPermissions('platform.planes.gestionar')
  crear(@Body() dto: CrearPlanDto) {
    return this.planesService.crear(dto);
  }

  @Patch(':id')
  @PlatformPermissions('platform.planes.gestionar')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarPlanDto) {
    return this.planesService.actualizar(id, dto);
  }
}
