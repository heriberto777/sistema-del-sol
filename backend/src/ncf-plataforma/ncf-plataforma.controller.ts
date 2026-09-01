import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NcfPlataformaService } from './ncf-plataforma.service';
import { CrearNcfPlataformaDto } from './dto/crear-ncf-plataforma.dto';
import { ActualizarNcfPlataformaDto } from './dto/actualizar-ncf-plataforma.dto';
import { Public } from '../common/decorators/public.decorator';
import { PlatformPermissions } from '../common/decorators/platform-permissions.decorator';
import { PlatformAuthGuard } from '../platform-auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../common/guards/platform-permissions.guard';

@ApiBearerAuth()
@ApiTags('platform-ncf')
@Public()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/ncf')
export class NcfPlataformaController {
  constructor(private readonly ncfPlataformaService: NcfPlataformaService) {}

  @Get()
  @PlatformPermissions('platform.facturacion.ver')
  listar() {
    return this.ncfPlataformaService.listar();
  }

  @Post()
  @PlatformPermissions('platform.facturacion.gestionar')
  crear(@Body() dto: CrearNcfPlataformaDto) {
    return this.ncfPlataformaService.crear(dto);
  }

  @Patch(':id')
  @PlatformPermissions('platform.facturacion.gestionar')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarNcfPlataformaDto) {
    return this.ncfPlataformaService.actualizar(id, dto);
  }
}
