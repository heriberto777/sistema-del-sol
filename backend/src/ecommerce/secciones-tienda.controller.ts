import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EcommerceService } from './ecommerce.service';
import { CrearSeccionTiendaDto } from './dto/crear-seccion-tienda.dto';
import { ReordenarSeccionesTiendaDto } from './dto/reordenar-secciones-tienda.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

/**
 * Panel admin "Secciones del Home" de la Tienda Online (Fase 17,
 * "Secciones Dinámicas"). Permisos propios `ecommerce.ver`/
 * `ecommerce.secciones.editar` (auditoría de organización, "100% ERP") —
 * antes todo el dominio compartía `admin.configuracion` sin ninguna
 * granularidad propia, a diferencia de CRM/Travel/Inmobiliaria/
 * Publicaciones Sociales. `@RequiereModulo('ecommerce')` — ver el
 * comentario equivalente en EcommercePedidosController sobre por qué
 * faltaba y qué permitía.
 */
@ApiBearerAuth()
@ApiTags('admin-ecommerce')
@RequiereModulo('ecommerce')
@Controller('admin/ecommerce/secciones')
export class SeccionesTiendaController {
  constructor(private readonly ecommerceService: EcommerceService) {}

  @Get()
  @Permissions('ecommerce.ver')
  listar() {
    return this.ecommerceService.listarSecciones();
  }

  @Post()
  @Permissions('ecommerce.secciones.editar')
  crear(@Body() dto: CrearSeccionTiendaDto, @CurrentUser() user: JwtPayloadUser) {
    return this.ecommerceService.crearSeccion(dto, user.tenantId);
  }

  @Patch(':id')
  @Permissions('ecommerce.secciones.editar')
  actualizar(@Param('id') id: string, @Body() dto: Partial<CrearSeccionTiendaDto>) {
    return this.ecommerceService.actualizarSeccion(id, dto);
  }

  @Delete(':id')
  @Permissions('ecommerce.secciones.editar')
  eliminar(@Param('id') id: string) {
    return this.ecommerceService.eliminarSeccion(id);
  }

  /** Reemplazo total del orden — ver ReordenarSeccionesTiendaDto. */
  @Put('orden')
  @Permissions('ecommerce.secciones.editar')
  reordenar(@Body() dto: ReordenarSeccionesTiendaDto) {
    return this.ecommerceService.reordenarSecciones(dto);
  }
}
