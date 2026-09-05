import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CuponesPlataformaService } from './cupones-plataforma.service';
import { CrearCuponDto } from '../dto/crear-cupon.dto';
import { ActualizarCuponDto } from '../dto/actualizar-cupon.dto';
import { Public } from '../../common/decorators/public.decorator';
import { PlatformPermissions } from '../../common/decorators/platform-permissions.decorator';
import { PlatformAuthGuard } from '../../platform-auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../../common/guards/platform-permissions.guard';

/** Catálogo de cupones — su APLICACIÓN a un tenant puntual vive en SuscripcionController (/platform/tenants/:id/suscripcion/cupon). */
@ApiBearerAuth()
@ApiTags('platform-cupones')
@Public()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/cupones')
export class CuponesPlataformaController {
  constructor(private readonly cuponesPlataformaService: CuponesPlataformaService) {}

  @Get()
  @PlatformPermissions('platform.facturacion.ver')
  listar() {
    return this.cuponesPlataformaService.listar();
  }

  @Post()
  @PlatformPermissions('platform.facturacion.gestionar')
  crear(@Body() dto: CrearCuponDto) {
    return this.cuponesPlataformaService.crear(dto);
  }

  @Patch(':id')
  @PlatformPermissions('platform.facturacion.gestionar')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarCuponDto) {
    return this.cuponesPlataformaService.actualizar(id, dto);
  }
}
