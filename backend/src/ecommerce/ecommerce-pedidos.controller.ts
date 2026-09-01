import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EcommerceService } from './ecommerce.service';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';

/** Panel "Pedidos de mi tienda" del admin del tenant — mismo permiso que el resto de la configuración de Tienda Online (ver TiendaOnlineConfigPanel). */
@ApiBearerAuth()
@ApiTags('admin-ecommerce')
@Controller('admin/ecommerce')
export class EcommercePedidosController {
  constructor(private readonly ecommerceService: EcommerceService) {}

  @Get('pedidos')
  @Permissions('admin.configuracion')
  listarPedidos(@Query() query: ListadoQueryDto) {
    return this.ecommerceService.listarPedidos(query);
  }
}
