import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlanesService } from './planes.service';
import { CrearPlanDto } from './dto/crear-plan.dto';
import { ActualizarPlanDto } from './dto/actualizar-plan.dto';
import { Public } from '../common/decorators/public.decorator';
import { PlatformAuthGuard } from '../platform-auth/guards/platform-auth.guard';

@ApiBearerAuth()
@ApiTags('platform-planes')
@Public() // el JwtAuthGuard global de tenants no debe intervenir aquí
@UseGuards(PlatformAuthGuard)
@Controller('platform/planes')
export class PlanesController {
  constructor(private readonly planesService: PlanesService) {}

  @Get('modulos')
  listarModulos() {
    return this.planesService.listarModulos();
  }

  @Get()
  listar() {
    return this.planesService.listar();
  }

  @Get(':id')
  buscarPorId(@Param('id') id: string) {
    return this.planesService.buscarPorId(id);
  }

  @Post()
  crear(@Body() dto: CrearPlanDto) {
    return this.planesService.crear(dto);
  }

  @Patch(':id')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarPlanDto) {
    return this.planesService.actualizar(id, dto);
  }
}
