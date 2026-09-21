import { Controller, Get, Param, Query } from '@nestjs/common';
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

  // Ruta literal antes de ':facturaId' — si no, la captura como si fuera un id.
  @Get('pedidos/resumen-pendientes')
  @Permissions('admin.configuracion')
  resumenPendientes() {
    return this.ecommerceService.resumenPendientes();
  }

  @Get('pedidos/:facturaId')
  @Permissions('admin.configuracion')
  detallePedido(@Param('facturaId') facturaId: string) {
    return this.ecommerceService.detallePedidoAdmin(facturaId);
  }

  /** Dominios propios ACTIVOS del tenant (ver TenantDominio) — para mostrar el link real en "Enlace de tu tienda", junto al subdominio de ciguadev.com. Gestionados solo por el super admin, acá de solo lectura. */
  @Get('dominios')
  @Permissions('admin.configuracion')
  listarDominios() {
    return this.ecommerceService.listarDominiosActivos();
  }
}
