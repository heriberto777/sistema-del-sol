import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EcommerceService } from './ecommerce.service';
import { CrearSeccionTiendaDto } from './dto/crear-seccion-tienda.dto';
import { ReordenarSeccionesTiendaDto } from './dto/reordenar-secciones-tienda.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

/** Panel admin "Secciones del Home" de la Tienda Online (Fase 17, "Secciones Dinámicas") — mismo permiso que el resto de la configuración (ver TiendaOnlineConfigPanel/EcommercePedidosController). */
@ApiBearerAuth()
@ApiTags('admin-ecommerce')
@Controller('admin/ecommerce/secciones')
export class SeccionesTiendaController {
  constructor(private readonly ecommerceService: EcommerceService) {}

  @Get()
  @Permissions('admin.configuracion')
  listar() {
    return this.ecommerceService.listarSecciones();
  }

  @Post()
  @Permissions('admin.configuracion')
  crear(@Body() dto: CrearSeccionTiendaDto, @CurrentUser() user: JwtPayloadUser) {
    return this.ecommerceService.crearSeccion(dto, user.tenantId);
  }

  @Patch(':id')
  @Permissions('admin.configuracion')
  actualizar(@Param('id') id: string, @Body() dto: Partial<CrearSeccionTiendaDto>) {
    return this.ecommerceService.actualizarSeccion(id, dto);
  }

  @Delete(':id')
  @Permissions('admin.configuracion')
  eliminar(@Param('id') id: string) {
    return this.ecommerceService.eliminarSeccion(id);
  }

  /** Reemplazo total del orden — ver ReordenarSeccionesTiendaDto. */
  @Put('orden')
  @Permissions('admin.configuracion')
  reordenar(@Body() dto: ReordenarSeccionesTiendaDto) {
    return this.ecommerceService.reordenarSecciones(dto);
  }
}
